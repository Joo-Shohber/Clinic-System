import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { Role } from "../../types/enums";
import * as controller from "./schedule.controller";
import { CreateScheduleDto, UpdateScheduleDto } from "./schedule.schema";

const router = Router();

// كل الـ schedule routes تحتاج doctor role
router.use(authenticate, authorize(Role.DOCTOR));

router.post(
  "/",
  validate(CreateScheduleDto),
  asyncHandler(controller.createSchedule),
);
router.get("/", asyncHandler(controller.getMySchedules));
router.patch(
  "/:id",
  validate(UpdateScheduleDto),
  asyncHandler(controller.updateSchedule),
);
router.delete("/:id", asyncHandler(controller.deleteSchedule));

export default router;
