import { z } from "zod";
import { Day } from "../../types/enums";

const BaseScheduleDto = z.object({
  day: z.nativeEnum(Day),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format HH:MM"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format HH:MM"),
  slotDuration: z.number().int().min(5).max(240),
});

export const CreateScheduleDto = BaseScheduleDto.refine(
  (data) => data.startTime < data.endTime,
  {
    message: "endTime must be after startTime",
    path: ["endTime"],
  },
);

export const UpdateScheduleDto = BaseScheduleDto.partial().refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.startTime < data.endTime;
    }

    return true;
  },
  {
    message: "endTime must be after startTime",
    path: ["endTime"],
  },
);

export type CreateScheduleDtoType = z.infer<typeof CreateScheduleDto>;
export type UpdateScheduleDtoType = z.infer<typeof UpdateScheduleDto>;
