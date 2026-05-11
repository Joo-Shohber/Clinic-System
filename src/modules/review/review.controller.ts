import { Request, Response } from "express";
import * as reviewService from "./review.service";
import { Role } from "../../types/enums";

export async function createReview(req: Request, res: Response): Promise<void> {
  const review = await reviewService.createReview(req.user.userId, req.body);
  res.status(201).json({ success: true, data: { review } });
}

export async function getDoctorReviews(
  req: Request,
  res: Response,
): Promise<void> {
  const { doctorId } = req.params as { doctorId: string };
  const result = await reviewService.getDoctorReviews(
    doctorId,
    req.query as any,
  );
  res.status(200).json({ success: true, data: result });
}

export async function updateReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const review = await reviewService.updateReview(
    id,
    req.user.userId,
    req.body,
  );
  res.status(200).json({ success: true, data: { review } });
}

export async function deleteReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await reviewService.deleteReview(id, req.user.userId, req.user.role as Role);
  res
    .status(200)
    .json({ success: true, message: "Review deleted successfully" });
}
