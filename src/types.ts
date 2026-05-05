export type PhotoStatus = "pending" | "kept" | "dismissed";

export interface PhotoGroup {
  groupId: number;
  desc: string;
  groupSize: number;
  index: number;
  isHighest?: boolean;
}

export interface Photo {
  id: number;
  filename: string;
  filepath: string;
  score: number; // raw float 1.0–5.0
  status: PhotoStatus;
  locked: boolean;
  selected: boolean;
  group: PhotoGroup | null;
  date: string; // ISO date "2026-01-15"
  dateObj: Date;
  width: number;
  height: number;
  fileSize: number; // bytes
}

export interface FilterState {
  mode: "all" | "pending" | "kept";
  scoreThreshold: number;
  showingDismissed: boolean;
  showingLocked: boolean;
  searchQuery: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ImportResult {
  count: number;
  dateRange: { min: string; max: string };
  files: string[];
}

export type ScoreLabel =
  | "1" | "1+"
  | "2-" | "2" | "2+"
  | "3-" | "3" | "3+"
  | "4-" | "4" | "4+"
  | "5-" | "5";

export interface ScoreDistribution {
  base: number; // 1–5
  count: number;
  percentage: number;
}

export interface PhotoFeedback {
  photoId: number;
  oldScore: number;
  newScore: number;
  timestamp: string;
}
