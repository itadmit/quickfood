import {
  isWithinOpenHours,
  PREORDER_HORIZON_DAYS,
  type BranchHours,
} from "@/lib/branch-hours";

export type RescheduleError = "in_past" | "too_far" | "outside_hours";

export const RESCHEDULE_ERROR_MESSAGE: Record<RescheduleError, string> = {
  in_past: "השעה החדשה כבר עברה",
  too_far: `אפשר לתזמן עד ${PREORDER_HORIZON_DAYS} ימים קדימה`,
  outside_hours: "השעה שנבחרה מחוץ לשעות הפעילות של הסניף",
};

export function validateRescheduleTime(
  next: Date | null,
  hours: BranchHours,
  now: Date = new Date(),
): RescheduleError | null {
  if (!next) return null;
  if (next.getTime() <= now.getTime()) return "in_past";
  if (next.getTime() > now.getTime() + (PREORDER_HORIZON_DAYS + 1) * 86_400_000) return "too_far";
  if (!isWithinOpenHours(hours, next)) return "outside_hours";
  return null;
}

export function rescheduleDeltaMs(
  order: { scheduledFor: Date | null; createdAt: Date },
  next: Date | null,
  now: Date = new Date(),
): number {
  return (next ?? now).getTime() - (order.scheduledFor ?? order.createdAt).getTime();
}
