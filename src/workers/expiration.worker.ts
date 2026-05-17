import { Job } from "bullmq";
import { createWorker } from "./queue.definitions";
import { Appointment } from "../models/appointment.model";
import {
  AppointmentStatus,
  PaymentStatus,
  NotificationType,
} from "../types/enums";
import { cacheService, REDIS_KEYS } from "../services/cache.service";
import { wsEmit } from "../services/websocket.service";
import { getNotificationQueue } from "./queue.definitions";
import { processRefund } from "../modules/payment/payment.service";
import { logger } from "../config/logger";

interface ExpirationJobData {
  appointmentId: string;
}

export function startExpirationWorker() {
  const worker = createWorker(
    "appointment-expiration",
    async (job: Job<ExpirationJobData>) => {
      const { appointmentId } = job.data;

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) return;

      if (appointment.status !== AppointmentStatus.PENDING) return;

      if (
        appointment.paymentStatus === PaymentStatus.PAID &&
        appointment.paymentIntentId
      ) {
        await processRefund(appointment.paymentIntentId);
        appointment.paymentStatus = PaymentStatus.REFUNDED;
      }
      appointment.status = AppointmentStatus.EXPIRED;
      await appointment.save();

      // Invalidate slots cache
      const dateStr = appointment.date.toISOString().split("T")[0]!;
      await cacheService.del(
        REDIS_KEYS.doctorSlots(appointment.doctorId.toString(), dateStr),
      );

      // WebSocket
      wsEmit.appointmentExpired(
        appointment.patientId.toString(),
        appointmentId,
      );

      // Email notification
      await getNotificationQueue().add(
        NotificationType.APPOINTMENT_EXPIRED,
        {
          type: NotificationType.APPOINTMENT_EXPIRED,
          appointmentId,
          userId: appointment.patientId.toString(),
        },
        { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
      );

      logger.info({ appointmentId }, "Appointment expired");
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Expiration job failed");
  });

  logger.info("Expiration worker started");
  return worker;
}
