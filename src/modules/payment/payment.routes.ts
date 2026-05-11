import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { Role } from "../../types/enums";
import * as controller from "./payment.controller";

const router = Router();

// [patient]
router.post(
  "/create-intent/:appointmentId",
  authenticate,
  authorize(Role.PATIENT),
  asyncHandler(controller.createPaymentIntent),
);

// [stripe webhook] — بدون authenticate، Stripe بيوقع بنفسه
// raw body middleware بيتسجل في app.ts على الـ path ده بس
router.post("/webhook", asyncHandler(controller.stripeWebhook));

// [admin]
router.post(
  "/refund/:appointmentId",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(controller.refundAppointment),
);

export default router;
