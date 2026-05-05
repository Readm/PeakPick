import type { DateRange } from "../types";

export type DatePreset = "today" | "3days" | "week" | "month" | "all";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDateRange(start: Date, end: Date): string {
  return `📅 ${formatDate(start)} → ${formatDate(end)}`;
}

export function computeDatePreset(
  preset: DatePreset,
  refDate: Date,
  minDate: Date,
  maxDate: Date
): DateRange {
  let start = minDate;
  let end = maxDate;

  switch (preset) {
    case "today":
      start = new Date(refDate.getTime() - ONE_DAY_MS);
      end = refDate;
      break;
    case "3days":
      start = new Date(refDate.getTime() - 3 * ONE_DAY_MS);
      end = refDate;
      break;
    case "week":
      start = new Date(refDate.getTime() - 7 * ONE_DAY_MS);
      end = refDate;
      break;
    case "month":
      start = new Date(refDate.getTime() - 30 * ONE_DAY_MS);
      end = refDate;
      break;
    case "all":
      break;
  }

  // Clamp
  start = new Date(Math.max(start.getTime(), minDate.getTime()));
  end = new Date(Math.min(end.getTime(), maxDate.getTime()));

  return { start, end };
}

export function dateRangeToPercent(
  d: Date,
  minDate: Date,
  maxDate: Date
): number {
  const totalMs = maxDate.getTime() - minDate.getTime();
  if (totalMs <= 0) return 0;
  return ((d.getTime() - minDate.getTime()) / totalMs) * 100;
}

export function percentToDate(
  pct: number,
  minDate: Date,
  maxDate: Date
): Date {
  const totalMs = maxDate.getTime() - minDate.getTime();
  return new Date(minDate.getTime() + (totalMs * pct) / 100);
}

export function generateMonthTicks(
  minDate: Date,
  maxDate: Date
): { date: Date; percent: number; label: string }[] {
  const ticks: { date: Date; percent: number; label: string }[] = [];
  const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const totalMs = maxDate.getTime() - minDate.getTime();
  while (d <= maxDate) {
    const pct = ((d.getTime() - minDate.getTime()) / totalMs) * 100;
    ticks.push({
      date: new Date(d),
      percent: pct,
      label: d.toLocaleDateString("zh-CN", { month: "short" }),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}
