import { Request, Response } from "express";
import * as scheduleService from "./schedule.service";

export async function createSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  const schedule = await scheduleService.createSchedule(
    req.user.userId,
    req.body,
  );
  res.status(201).json({ success: true, data: { schedule } });
}

export async function getMySchedules(
  req: Request,
  res: Response,
): Promise<void> {
  const schedules = await scheduleService.getMySchedules(req.user.userId);
  res.status(200).json({ success: true, data: { schedules } });
}

export async function updateSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const schedule = await scheduleService.updateSchedule(
    id,
    req.user.userId,
    req.body,
  );
  res.status(200).json({ success: true, data: { schedule } });
}

export async function deleteSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  await scheduleService.deleteSchedule(id, req.user.userId);
  res
    .status(200)
    .json({ success: true, message: "Schedule deleted successfully" });
}
