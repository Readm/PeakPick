import type { ScoreLabel } from "../types";

/**
 * 13 evenly-spaced score labels from 1.0 to 5.0:
 * 1, 1+, 2-, 2, 2+, 3-, 3, 3+, 4-, 4, 4+, 5-, 5
 * Each step spans ~0.333 points.
 */
export const SCORE_LABELS: ScoreLabel[] = [
  "1", "1+",
  "2-", "2", "2+",
  "3-", "3", "3+",
  "4-", "4", "4+",
  "5-", "5",
];

/** Center values for each label (even 13-step spacing) */
const LABEL_CENTERS: Record<ScoreLabel, number> = {
  "1": 1.0,
  "1+": 1.333,
  "2-": 1.666,
  "2": 2.0,
  "2+": 2.333,
  "3-": 2.666,
  "3": 3.0,
  "3+": 3.333,
  "4-": 3.666,
  "4": 4.0,
  "4+": 4.333,
  "5-": 4.666,
  "5": 5.0,
};

/** Thresholds (midpoint between centers) to map a raw score to a label */
const LABEL_THRESHOLDS: { threshold: number; label: ScoreLabel }[] = [
  { threshold: 1.166, label: "1" },
  { threshold: 1.5, label: "1+" },
  { threshold: 1.833, label: "2-" },
  { threshold: 2.166, label: "2" },
  { threshold: 2.5, label: "2+" },
  { threshold: 2.833, label: "3-" },
  { threshold: 3.166, label: "3" },
  { threshold: 3.5, label: "3+" },
  { threshold: 3.833, label: "4-" },
  { threshold: 4.166, label: "4" },
  { threshold: 4.5, label: "4+" },
  { threshold: 4.833, label: "5-" },
];

/**
 * Convert a raw numeric score (1.0–5.0) to a human-readable label.
 * Examples: 2.8 → "3-", 4.2 → "4", 3.4 → "3+"
 */
export function formatScore(val: number | null | undefined): ScoreLabel | "--" {
  if (val === null || val === undefined) return "--";
  for (const t of LABEL_THRESHOLDS) {
    if (val <= t.threshold) return t.label;
  }
  return "5";
}

/**
 * Convert a score label back to its numeric center value.
 * Examples: "3-" → 2.666, "3+" → 3.333, "3" → 3.0
 */
export function parseLabel(label: ScoreLabel | "--" | string): number {
  if (label === "--") return 0;
  const center = LABEL_CENTERS[label as ScoreLabel];
  if (center !== undefined) return center;
  const parsed = parseInt(label);
  return isNaN(parsed) ? 3.0 : parsed + 0.3;
}

/**
 * Get the cycle order for variants of a base number.
 * Order: n → n+ → n- → n (neutral → plus → minus → neutral)
 */
export function getBaseVariants(base: number): ScoreLabel[] {
  const all = SCORE_LABELS.filter((l) => parseInt(l) === base);
  const neut = all.find((l) => !l.includes("+") && !l.includes("-"));
  const plus = all.find((l) => l.includes("+"));
  const minus = all.find((l) => l.includes("-"));
  const ordered: ScoreLabel[] = [];
  if (neut) ordered.push(neut);
  if (plus) ordered.push(plus);
  if (minus) ordered.push(minus);
  return ordered;
}

/**
 * Get the base integer of a score label.
 * "3-" → 3, "4+" → 4
 */
export function scoreBase(label: ScoreLabel | string): number {
  return parseInt(label) || 1;
}

/**
 * Generate score distribution counts grouped by base integer (1–5).
 */
export function computeScoreDistribution(
  scores: number[]
): { base: number; count: number }[] {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of scores) {
    const base = scoreBase(formatScore(s));
    if (counts[base] !== undefined) counts[base]++;
  }
  return [1, 2, 3, 4, 5].map((base) => ({ base, count: counts[base] }));
}
