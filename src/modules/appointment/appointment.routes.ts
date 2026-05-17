import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { idempotency } from "../../middleware/idempotency";
import { Role } from "../../types/enums";
import * as controller from "./appointment.controller";
import {
  CreateAppointmentDto,
  ListMyAppointmentsDto,
  ListAllAppointmentsDto,
  CompleteAppointmentDto,
} from "./appointment.schema";

const router = Router();

// [patient] Book appointment
router.post(
  "/",
  authenticate,
  authorize(Role.PATIENT),
  idempotency(),
  validate(CreateAppointmentDto),
  asyncHandler(controller.createAppointment),
);

// [auth] My appointments — patient و doctor
router.get(
  "/me",
  authenticate,
  validate(ListMyAppointmentsDto, "query"),
  asyncHandler(controller.getMyAppointments),
);

// [admin] All appointments
router.get(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  validate(ListAllAppointmentsDto, "query"),
  asyncHandler(controller.getAllAppointments),
);

// [auth] Single appointment
router.get("/:id", authenticate, asyncHandler(controller.getAppointmentById));

// [patient | doctor | admin] Cancel
router.patch(
  "/:id/cancel",
  authenticate,
  asyncHandler(controller.cancelAppointment),
);

// [doctor] Complete
router.patch(
  "/:id/complete",
  authenticate,
  authorize(Role.DOCTOR),
  validate(CompleteAppointmentDto),
  asyncHandler(controller.completeAppointment),
);

export default router;
