import mongoose, { Document, Schema } from "mongoose";
import { AppointmentStatus, PaymentStatus } from "../types/enums";
import getEnv from "../config/env";

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  scheduleId: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentIntentId?: string;
  patientNotes?: string;
  doctorNotes?: string;
  expiresAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format, use HH:MM"],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format, use HH:MM"],
    },
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: AppointmentStatus.PENDING,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },
    paymentIntentId: {
      type: String,
    },
    patientNotes: {
      type: String,
      maxlength: 500,
    },
    doctorNotes: {
      type: String,
      maxlength: 1000,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => {
        const env = getEnv();
        return new Date(
          Date.now() + env.APPOINTMENT_EXPIRY_MINUTES * 60 * 1000,
        );
      },
    },
    confirmedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

appointmentSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  { unique: true },
);

appointmentSchema.index({ patientId: 1, status: 1 });

appointmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Appointment = mongoose.model<IAppointment>(
  "Appointment",
  appointmentSchema,
);
