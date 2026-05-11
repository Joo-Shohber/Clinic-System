import Stripe from "stripe";
import getEnv from "../../config/env";
import { Appointment } from "../../models/appointment.model";
import { Doctor } from "../../models/doctor.model";
import { AppError } from "../../types/errors";
import {
  AppointmentStatus,
  PaymentStatus,
  NotificationType,
} from "../../types/enums";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { wsEmit } from "../../services/websocket.service";
import {
  getExpirationQueue,
  getNotificationQueue,
} from "../../workers/queue.definitions";

let _stripe: InstanceType<typeof Stripe> | null = null;

export function getStripe(): InstanceType<typeof Stripe> {
  if (_stripe) return _stripe;
  _stripe = new Stripe(getEnv().STRIPE_SECRET_KEY);
  return _stripe;
}

// ===== Create Payment Intent =====

export async function createPaymentIntent(
  appointmentId: string,
  patientId: string,
): Promise<{ clientSecret: string }> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment)
    throw new AppError("NOT_FOUND", 404, "Appointment not found");
  if (appointment.patientId.toString() !== patientId) {
    throw new AppError("FORBIDDEN", 403, "Not your appointment");
  }
  if (appointment.status !== AppointmentStatus.PENDING) {
    throw new AppError("INVALID_STATUS", 400, "Appointment is not pending");
  }

  const doctor = await Doctor.findById(appointment.doctorId);
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor not found");

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: doctor.fees * 100, // piastres
    currency: "egp",
    metadata: { appointmentId, patientId },
  });

  appointment.paymentIntentId = paymentIntent.id;
  await appointment.save();

  if (!paymentIntent.client_secret) {
    throw new AppError("PAYMENT_ERROR", 500, "Failed to create payment intent");
  }

  return { clientSecret: paymentIntent.client_secret };
}

// ===== Stripe Webhook =====

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  const env = getEnv();
  const stripe = getStripe();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError("WEBHOOK_INVALID", 400, "Invalid webhook signature");
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onPaymentSucceeded(event.data.object as any);
      break;
    case "payment_intent.payment_failed":
      break;
    default:
      break;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onPaymentSucceeded(paymentIntent: any): Promise<void> {
  const appointment = await Appointment.findOne({
    paymentIntentId: paymentIntent.id,
  });
  if (!appointment) return;
  if (appointment.status === AppointmentStatus.CONFIRMED) return; // idempotent

  appointment.status = AppointmentStatus.CONFIRMED;
  appointment.paymentStatus = PaymentStatus.PAID;
  appointment.confirmedAt = new Date();
  await appointment.save();

  // Invalidate slots cache
  const dateStr = appointment.date.toISOString().split("T")[0]!;
  await cacheService.del(
    REDIS_KEYS.doctorSlots(appointment.doctorId.toString(), dateStr),
  );

  // Remove BullMQ expiry job

  const job = await getExpirationQueue().getJob(appointment._id.toString());
  if (job) await job.remove();

  // WebSocket
  wsEmit.appointmentConfirmed(
    appointment.patientId.toString(),
    appointment._id.toString(),
  );

  // Email notification via worker

  await getNotificationQueue().add(
    NotificationType.APPOINTMENT_CONFIRMED,
    {
      type: NotificationType.APPOINTMENT_CONFIRMED,
      appointmentId: appointment._id.toString(),
      userId: appointment.patientId.toString(),
    },
    { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
  );

  // Schedule reminder 24h before
  const appointmentDateTime = new Date(appointment.date);
  const [h, m] = appointment.startTime.split(":").map(Number);
  appointmentDateTime.setUTCHours(h!, m!, 0, 0);
  const reminderDelay =
    appointmentDateTime.getTime() - Date.now() - 24 * 60 * 60 * 1000;

  if (reminderDelay > 0) {
    await getNotificationQueue().add(
      NotificationType.APPOINTMENT_REMINDER,
      {
        type: NotificationType.APPOINTMENT_REMINDER,
        appointmentId: appointment._id.toString(),
        userId: appointment.patientId.toString(),
      },
      {
        delay: reminderDelay,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  }
}

// ===== Refund =====

export async function refundAppointment(appointmentId: string): Promise<void> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment)
    throw new AppError("NOT_FOUND", 404, "Appointment not found");
  if (appointment.paymentStatus !== PaymentStatus.PAID) {
    throw new AppError("NOT_PAID", 400, "Appointment was not paid");
  }
  if (!appointment.paymentIntentId) {
    throw new AppError("NO_PAYMENT_INTENT", 400, "No payment intent found");
  }

  await processRefund(appointment.paymentIntentId);
  appointment.paymentStatus = PaymentStatus.REFUNDED;
  await appointment.save();
}

// بتتاستخدم كمان من expiration worker و cancel flow
export async function processRefund(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = paymentIntent.latest_charge as string | null;
  if (!chargeId) return;
  await stripe.refunds.create({ charge: chargeId });
}
