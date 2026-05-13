import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { Role } from "../../types/enums";
import * as controller from "./doctor.controller";
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorsQuerySchema,
  verifyDoctorSchema,
  getSlotsQuerySchema,
} from "./doctor.schema";

const router = Router();

// [public]
router.get(
  "/",
  validate(listDoctorsQuerySchema, "query"),
  asyncHandler(controller.listDoctors),
);

// [doctor]
router.get(
  "/me",
  authenticate,
  authorize(Role.DOCTOR),
  asyncHandler(controller.getMyDoctorProfile),
);

router.get("/:id", asyncHandler(controller.getDoctorById));

// [auth]
router.get(
  "/:id/slots",
  authenticate,
  validate(getSlotsQuerySchema, "query"),
  asyncHandler(controller.getAvailableSlots),
);

// [doctor]
router.post(
  "/",
  authenticate,
  authorize(Role.DOCTOR),
  validate(createDoctorSchema),
  asyncHandler(controller.createDoctor),
);

router.patch(
  "/:id",
  authenticate,
  authorize(Role.DOCTOR),
  validate(updateDoctorSchema),
  asyncHandler(controller.updateDoctor),
);

// [admin]
router.patch(
  "/:id/verify",
  authenticate,
  authorize(Role.ADMIN),
  validate(verifyDoctorSchema),
  asyncHandler(controller.verifyDoctor),
);

export default router;
