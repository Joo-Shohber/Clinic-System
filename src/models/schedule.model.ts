import mongoose, { Document, Schema } from "mongoose";
import { Day } from "../types/enums";

export interface ISchedule extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  day: Day;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDuration: number; // minutes
  isActive: boolean;
}

const scheduleSchema = new Schema<ISchedule>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    day: {
      type: String,
      enum: Object.values(Day),
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
    slotDuration: {
      type: Number,
      required: true,
      min: 5,
      max: 240,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scheduleSchema.index({ doctorId: 1, day: 1 }, { unique: true });

export const Schedule = mongoose.model<ISchedule>("Schedule", scheduleSchema);
