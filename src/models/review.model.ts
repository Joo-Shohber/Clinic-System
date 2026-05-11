import mongoose, { Document, Schema } from "mongoose";
import { Doctor } from "./doctor.model";

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
}

const reviewSchema = new Schema<IReview>(
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
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ===== Review Aggregation Helper =====
async function recalculateDoctorRating(
  doctorId: mongoose.Types.ObjectId,
): Promise<void> {
  const stats = await Review.aggregate([
    { $match: { doctorId } },
    {
      $group: {
        _id: null,
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  await Doctor.findByIdAndUpdate(doctorId, {
    averageRating: stats[0]?.avg ?? 0,
    totalReviews: stats[0]?.count ?? 0,
  });
}

reviewSchema.post("save", async function () {
  await recalculateDoctorRating(this.doctorId);
});

reviewSchema.post("findOneAndDelete", async function (doc: IReview | null) {
  if (doc) {
    await recalculateDoctorRating(doc.doctorId);
  }
});

export const Review = mongoose.model<IReview>("Review", reviewSchema);
