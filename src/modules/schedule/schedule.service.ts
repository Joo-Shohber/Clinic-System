import { Schedule, ISchedule } from "../../models/schedule.model";
import { Doctor } from "../../models/doctor.model";
import { AppError } from "../../types/errors";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import {
  CreateScheduleDtoType,
  UpdateScheduleDtoType,
} from "./schedule.schema";

// helper — بيتحقق إن الـ doctor profile موجود وبيرجع الـ doctorId
async function getDoctorIdByUserId(userId: string): Promise<string> {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    throw new AppError("DOCTOR_NOT_FOUND", 404, "Doctor profile not found");
  }
  return doctor._id.toString();
}

// بيمسح كل الـ cached slots بتاعة الدكتور ده
// بنستخدمه لما الـ schedule يتعدل أو يتمسح
async function invalidateDoctorSlotsCache(doctorId: string): Promise<void> {
  await cacheService.invalidatePattern(`doctor:slots:${doctorId}:*`);
}

// ===== Create =====

export async function createSchedule(
  userId: string,
  input: CreateScheduleDtoType,
): Promise<ISchedule> {
  const doctorId = await getDoctorIdByUserId(userId);

  const existing = await Schedule.findOne({ doctorId, day: input.day });
  if (existing) {
    throw new AppError(
      "SCHEDULE_EXISTS",
      409,
      `Schedule for ${input.day} already exists`,
    );
  }

  const schedule = await Schedule.create({ doctorId, ...input });
  return schedule;
}

// ===== Get My Schedules =====

export async function getMySchedules(userId: string): Promise<ISchedule[]> {
  const doctorId = await getDoctorIdByUserId(userId);
  return Schedule.find({ doctorId }).sort({ day: 1 });
}

// ===== Update =====

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  input: UpdateScheduleDtoType,
): Promise<ISchedule> {
  const doctorId = await getDoctorIdByUserId(userId);

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new AppError("NOT_FOUND", 404, "Schedule not found");

  // بيتأكد إن الـ doctor بيعدل على schedule بتاعه هو بس
  if (schedule.doctorId.toString() !== doctorId) {
    throw new AppError("FORBIDDEN", 403, "Not your schedule");
  }

  Object.assign(schedule, input);
  await schedule.save();

  // لازم نمسح الـ cache عشان الـ slots اتغيرت
  await invalidateDoctorSlotsCache(doctorId);

  return schedule;
}

// ===== Delete =====

export async function deleteSchedule(
  scheduleId: string,
  userId: string,
): Promise<void> {
  const doctorId = await getDoctorIdByUserId(userId);

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new AppError("NOT_FOUND", 404, "Schedule not found");

  if (schedule.doctorId.toString() !== doctorId) {
    throw new AppError("FORBIDDEN", 403, "Not your schedule");
  }

  await schedule.deleteOne();
  await invalidateDoctorSlotsCache(doctorId);
}
