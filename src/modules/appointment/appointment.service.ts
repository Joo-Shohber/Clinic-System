import { Appointment, IAppointment } from "../../models/appointment.model";
import { Doctor } from "../../models/doctor.model";
import { Schedule } from "../../models/schedule.model";
import { AppError } from "../../types/errors";
import {
  AppointmentStatus,
  PaymentStatus,
  NotificationType,
  Role,
} from "../../types/enums";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { lockService } from "../../services/lock.service";
import { wsEmit } from "../../services/websocket.service";
import { generateSlots, getDayName } from "../../utils/schedule-generator";
import {
  getExpirationQueue,
  getNotificationQueue,
} from "../../workers/queue.definitions";
import { processRefund } from "../payment/payment.service";
import getEnv from "../../config/env";
import {
  CreateAppointmentDtoType,
  ListMyAppointmentsDtoType,
  ListAllAppointmentsDtoType,
  CompleteAppointmentDtoType,
} from "./appointment.schema";

// ===== Book Appointment =====

export async function createAppointment(
  patientId: string,
  input: CreateAppointmentDtoType,
) {
  const { doctorId, date, startTime, patientNotes } = input;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor not found");
  if (!doctor.isVerified || !doctor.isActive) {
    throw new AppError("DOCTOR_UNAVAILABLE", 400, "Doctor is not available");
  }

  const dateObj = new Date(date + "T00:00:00Z");
  const duplicate = await Appointment.findOne({
    patientId,
    doctorId,
    date: dateObj,
    startTime,
    status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
  });
  if (duplicate) {
    throw new AppError(
      "DUPLICATE_APPOINTMENT",
      409,
      "You already have this appointment",
    );
  }

  const dayName = getDayName(date);
  const schedule = await Schedule.findOne({
    doctorId,
    day: dayName,
    isActive: true,
  });
  if (!schedule) {
    throw new AppError(
      "NO_SCHEDULE",
      400,
      "Doctor has no schedule for this day",
    );
  }

  const allSlots = generateSlots(
    schedule.startTime,
    schedule.endTime,
    schedule.slotDuration,
  );
  const slot = allSlots.find((s) => s.startTime === startTime);
  if (!slot) {
    throw new AppError("INVALID_SLOT", 400, "Invalid time slot");
  }

  const lockKey = REDIS_KEYS.slotLock(doctorId, date, startTime);
  const env = getEnv();
  const appointment = await lockService.withLock(
    lockKey,
    env.LOCK_TTL_MS,
    async () => {
      const taken = await Appointment.findOne({
        doctorId,
        date: dateObj,
        startTime,
        status: {
          $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      });
      if (taken) {
        throw new AppError("SLOT_TAKEN", 409, "This slot is already booked");
      }

      return Appointment.create({
        doctorId,
        patientId,
        scheduleId: schedule._id,
        date: dateObj,
        startTime,
        endTime: slot.endTime,
        patientNotes,
        status: AppointmentStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
      });
    },
  );

  // BullMQ delayed job — fires at expiresAt to expire if not paid
  await getExpirationQueue().add(
    "expire-appointment",
    { appointmentId: appointment._id.toString() },
    {
      jobId: appointment._id.toString(), // unique jobId عشان نقدر نشيله لو اتدفع
      delay: appointment.expiresAt.getTime() - Date.now(),
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  );

  await cacheService.del(REDIS_KEYS.doctorSlots(doctorId, date));

  wsEmit.appointmentCreated(patientId, {
    appointmentId: appointment._id.toString(),
    doctorId,
    date,
    startTime,
  });

  return appointment;
}

// ===== Get My Appointments =====

export async function getMyAppointments(
  userId: string,
  role: Role,
  query: ListMyAppointmentsDtoType,
) {
  const { status, page, limit } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (role === Role.PATIENT) filter.patientId = userId;
  else if (role === Role.DOCTOR) {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor)
      throw new AppError("NOT_FOUND", 404, "Doctor profile not found");
    filter.doctorId = doctor._id;
  }

  if (status) filter.status = status;

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("doctorId", "doctorName specialization fees")
      .populate("patientId", "name email profilePhoto"),
    Appointment.countDocuments(filter),
  ]);

  return {
    appointments,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ===== Get All Appointments (Admin) =====

export async function getAllAppointments(query: ListAllAppointmentsDtoType) {
  const { status, doctorId, date, page, limit } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (doctorId) filter.doctorId = doctorId;
  if (date) filter.date = new Date(date + "T00:00:00Z");

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("doctorId", "doctorName specialization")
      .populate("patientId", "name email"),
    Appointment.countDocuments(filter),
  ]);

  return {
    appointments,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ===== Get Single Appointment =====

export async function getAppointmentById(
  appointmentId: string,
  userId: string,
  role: Role,
) {
  // doctor و admin يشوفوا الـ doctorNotes
  const query = Appointment.findById(appointmentId)
    .populate("doctorId", "doctorName specialization fees")
    .populate("patientId", "name email profilePhoto");

  if (role === Role.DOCTOR || role === Role.ADMIN) {
    query.select("+doctorNotes");
  }

  const appointment = await query;
  if (!appointment)
    throw new AppError("NOT_FOUND", 404, "Appointment not found");

  // patient يشوف appointment بتاعته بس
  if (
    role === Role.PATIENT &&
    appointment.patientId._id.toString() !== userId
  ) {
    throw new AppError("FORBIDDEN", 403, "Not your appointment");
  }

  // doctor يشوف appointments بتاعته بس
  if (role === Role.DOCTOR) {
    const doctor = await Doctor.findOne({ userId });
    if (
      !doctor ||
      appointment.doctorId._id.toString() !== doctor._id.toString()
    ) {
      throw new AppError("FORBIDDEN", 403, "Not your appointment");
    }
  }

  return appointment;
}

// ===== Cancel Appointment =====

export async function cancelAppointment(
  appointmentId: string,
  userId: string,
  role: Role,
) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment)
    throw new AppError("NOT_FOUND", 404, "Appointment not found");

  // Cancellation rules بالـ role
  if (role === Role.PATIENT) {
    if (appointment.patientId.toString() !== userId) {
      throw new AppError("FORBIDDEN", 403, "Not your appointment");
    }
    if (
      ![AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      throw new AppError(
        "INVALID_STATUS",
        400,
        "Cannot cancel this appointment",
      );
    }
  } else if (role === Role.DOCTOR) {
    const doctor = await Doctor.findOne({ userId });
    if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
      throw new AppError("FORBIDDEN", 403, "Not your appointment");
    }
    if (
      ![AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
        appointment.status,
      )
    ) {
      throw new AppError(
        "INVALID_STATUS",
        400,
        "Cannot cancel this appointment",
      );
    }
  }
  // admin → يقدر يكنسل أي status

  // Refund لو كان paid
  if (
    appointment.paymentStatus === PaymentStatus.PAID &&
    appointment.paymentIntentId
  ) {
    await processRefund(appointment.paymentIntentId);
    appointment.paymentStatus = PaymentStatus.REFUNDED;
  }

  // Remove expiry job لو كان pending
  if (appointment.status === AppointmentStatus.PENDING) {
    const job = await getExpirationQueue().getJob(appointmentId);
    if (job) await job.remove();
  }

  appointment.status = AppointmentStatus.CANCELLED;
  appointment.cancelledAt = new Date();
  await appointment.save();

  // Invalidate slots cache
  const dateStr = appointment.date.toISOString().split("T")[0]!;
  await cacheService.del(
    REDIS_KEYS.doctorSlots(appointment.doctorId.toString(), dateStr),
  );

  // WebSocket + notification
  wsEmit.appointmentCancelled(appointment.patientId.toString(), appointmentId);

  await getNotificationQueue().add(
    NotificationType.APPOINTMENT_CANCELLED,
    {
      type: NotificationType.APPOINTMENT_CANCELLED,
      appointmentId,
      userId: appointment.patientId.toString(),
    },
    { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
  );

  return appointment;
}

// ===== Complete Appointment =====

export async function completeAppointment(
  appointmentId: string,
  userId: string,
  input: CompleteAppointmentDtoType,
) {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor profile not found");

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment)
    throw new AppError("NOT_FOUND", 404, "Appointment not found");

  if (appointment.doctorId.toString() !== doctor._id.toString()) {
    throw new AppError("FORBIDDEN", 403, "Not your appointment");
  }

  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new AppError(
      "INVALID_STATUS",
      400,
      "Only confirmed appointments can be completed",
    );
  }

  appointment.status = AppointmentStatus.COMPLETED;
  if (input.doctorNotes) appointment.doctorNotes = input.doctorNotes;
  await appointment.save();

  wsEmit.appointmentCompleted(appointment.patientId.toString(), appointmentId);

  await getNotificationQueue().add(
    NotificationType.APPOINTMENT_COMPLETED,
    {
      type: NotificationType.APPOINTMENT_COMPLETED,
      appointmentId,
      userId: appointment.patientId.toString(),
    },
    { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
  );

  return appointment;
}
