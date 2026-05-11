import mongoose, { Document, Schema } from "mongoose";

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  doctorName: string;
  specialization: string;
  bio: string;
  fees: number;
  experience: number;
  isVerified: boolean;
  isActive: boolean;
  averageRating: number;
  totalReviews: number;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    bio: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    fees: {
      type: Number,
      required: true,
      min: 0,
    },
    experience: {
      type: Number,
      required: true,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

doctorSchema.index({ doctorName: "text", specialization: "text" });

export const Doctor = mongoose.model<IDoctor>("Doctor", doctorSchema);
