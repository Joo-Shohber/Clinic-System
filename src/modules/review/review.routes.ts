import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { Role } from "../../types/enums";
import * as controller from "./review.controller";
import {
  CreateReviewDto,
  UpdateReviewDto,
  ListReviewsDto,
} from "./review.schema";

const router = Router();

// [public] Doctor reviews
router.get(
  "/doctor/:doctorId",
  validate(ListReviewsDto, "query"),
  asyncHandler(controller.getDoctorReviews),
);

// [patient] Create review
router.post(
  "/",
  authenticate,
  authorize(Role.PATIENT),
  validate(CreateReviewDto),
  asyncHandler(controller.createReview),
);

// [patient] Update own review
router.patch(
  "/:id",
  authenticate,
  authorize(Role.PATIENT),
  validate(UpdateReviewDto),
  asyncHandler(controller.updateReview),
);

// [patient | admin] Delete review
router.delete(
  "/:id",
  authenticate,
  authorize(Role.PATIENT, Role.ADMIN),
  asyncHandler(controller.deleteReview),
);

export default router;
