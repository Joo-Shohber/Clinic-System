import { Doctor, IDoctor } from "../../models/doctor.model";
import { Schedule } from "../../models/schedule.model";
import { Appointment } from "../../models/appointment.model";
import { Review } from "../../models/review.model";
import { AppError } from "../../types/errors";
import { AppointmentStatus } from "../../types/enums";
import { cacheService, REDIS_KEYS } from "../../services/cache.service";
import { generateSlots, getDayName } from "../../utils/schedule-generator";
import {
  CreateDoctorInput,
  UpdateDoctorInput,
  ListDoctorsQuery,
  VerifyDoctorInput,
} from "./doctor.schema";

// ===== Get My Profile (Doctor) =====

export async function getMyDoctorProfile(userId: string) {
  const doctor = await Doctor.findOne({ userId }).lean();
  if (!doctor) {
    throw new AppError("NOT_FOUND", 404, "Doctor profile not found");
  }
  return doctor;
}

// ===== Create Doctor =====

export async function createDoctor(
  userId: string,
  input: CreateDoctorInput,
): Promise<IDoctor> {
  const existing = await Doctor.findOne({ userId });
  if (existing) {
    throw new AppError("DOCTOR_EXISTS", 409, "Doctor profile already exists");
  }

  return Doctor.create({ userId, ...input });
}

// ===== Get and List Doctors =====

export async function listDoctors(query: ListDoctorsQuery) {
  const { search, specialization, minRating, maxFees, page, limit } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { isVerified: true, isActive: true };

  if (search) filter.$text = { $search: search };
  if (specialization)
    filter.specialization = { $regex: specialization, $options: "i" };
  if (minRating !== undefined) filter.averageRating = { $gte: minRating };
  if (maxFees !== undefined) filter.fees = { $lte: maxFees };

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ averageRating: -1 })
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  return {
    doctors,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ===== Get Doctor by ID =====

export async function getDoctorById(doctorId: string) {
  const cached = await cacheService.get<object>(
    REDIS_KEYS.doctorProfile(doctorId),
  );
  if (cached) return cached;

  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor not found");

  const recentReviews = await Review.find({ doctorId })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate("patientId", "name profilePhoto")
    .lean();

  const result = { ...doctor, recentReviews };
  await cacheService.set(REDIS_KEYS.doctorProfile(doctorId), result);
  return result;
}

// ===== Update Doctor =====

export async function updateDoctor(
  doctorId: string,
  userId: string,
  input: UpdateDoctorInput,
): Promise<IDoctor> {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor not found");
  if (doctor.userId.toString() !== userId) {
    throw new AppError("FORBIDDEN", 403, "Not your profile");
  }

  Object.assign(doctor, input);
  await doctor.save();
  await cacheService.del(REDIS_KEYS.doctorProfile(doctorId));
  return doctor;
}

// ===== Verify (Admin) =====

export async function verifyDoctor(
  doctorId: string,
  input: VerifyDoctorInput,
): Promise<IDoctor> {
  const doctor = await Doctor.findByIdAndUpdate(
    doctorId,
    { isVerified: input.isVerified },
    { new: true },
  );
  if (!doctor) throw new AppError("NOT_FOUND", 404, "Doctor not found");

  await cacheService.del(REDIS_KEYS.doctorProfile(doctorId));
  return doctor;
}

// ===== Available Slots =====

export async function getAvailableSlots(doctorId: string, date: string) {
  const cacheKey = REDIS_KEYS.doctorSlots(doctorId, date);
  const cached = await cacheService.get<object[]>(cacheKey);
  if (cached) return cached;

  const dayName = getDayName(date);
  const schedule = await Schedule.findOne({
    doctorId,
    day: dayName,
    isActive: true,
  });
  if (!schedule) return [];

  const allSlots = generateSlots(
    schedule.startTime,
    schedule.endTime,
    schedule.slotDuration,
  );

  const dateObj = new Date(date + "T00:00:00Z");
  const booked = await Appointment.find({
    doctorId,
    date: dateObj,
    status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
  }).select("startTime");

  const bookedTimes = new Set(booked.map((a) => a.startTime));
  const available = allSlots.filter((s) => !bookedTimes.has(s.startTime));

  await cacheService.set(cacheKey, available);
  return available;
}
