export interface TimeSlot {
  startTime: string; // "09:00"
  endTime: string; // "09:30"
}

export function generateSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentMinutes);
    const slotEnd = minutesToTime(currentMinutes + durationMinutes);
    slots.push({ startTime: slotStart, endTime: slotEnd });
    currentMinutes += durationMinutes;
  }

  return slots;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

import { Day } from "../types/enums";

export function getDayName(dateStr: string): Day {
  const days: Day[] = [
    Day.SUN,
    Day.MON,
    Day.TUE,
    Day.WED,
    Day.THU,
    Day.FRI,
    Day.SAT,
  ];
  const date = new Date(dateStr + "T00:00:00Z");
  return days[date.getUTCDay()]!;
}
