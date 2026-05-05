import { useMemo, useCallback } from "react";
import { Camera, Upload } from "lucide-react";
import { usePhotoStore } from "../store";
import { computeDatePreset, formatDate } from "../lib/dates";
import type { DatePreset } from "../lib/dates";

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "今天", value: "today" },
  { label: "近3天", value: "3days" },
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
  { label: "全部", value: "all" },
];

const SCORE_FILTERS = [
  { label: "全部", value: 1 },
  { label: "高分 (4+)", value: 4 },
  { label: "中等 (3-~3+)", value: 3 },
  { label: "低分 (2+及以下)", value: 2 },
] as const;

export function Sidebar() {
  const photos = usePhotoStore((s) => s.photos);
  const filter = usePhotoStore((s) => s.filter);
  const setFilter = usePhotoStore((s) => s.setFilter);
  const dateRange = usePhotoStore((s) => s.dateRange);
  const setDateRange = usePhotoStore((s) => s.setDateRange);
  const setImportOpen = usePhotoStore((s) => s.setImportOpen);

  const dismissedCount = useMemo(
    () => photos.filter((p) => p.status === "dismissed").length,
    [photos]
  );
  const lockedCount = useMemo(
    () => photos.filter((p) => p.locked).length,
    [photos]
  );

  const photoCount = useMemo(
    () => photos.filter((p) => p.status !== "dismissed").length,
    [photos]
  );

  const minDate = useMemo(
    () =>
      photos.length > 0
        ? new Date(Math.min(...photos.map((p) => p.dateObj.getTime())))
        : new Date(),
    [photos]
  );
  const maxDate = useMemo(
    () =>
      photos.length > 0
        ? new Date(Math.max(...photos.map((p) => p.dateObj.getTime())))
        : new Date(),
    [photos]
  );

  const handleDatePreset = useCallback(
    (preset: DatePreset) => {
      const range = computeDatePreset(preset, new Date(), minDate, maxDate);
      setDateRange(range);
    },
    [minDate, maxDate, setDateRange]
  );

  const handleScoreFilter = useCallback(
    (val: number) => {
      setFilter({ scoreThreshold: val });
    },
    [setFilter]
  );

  const handleDismissedClick = useCallback(() => {
    setFilter({ showingDismissed: !filter.showingDismissed });
  }, [filter.showingDismissed, setFilter]);

  const handleLockedClick = useCallback(() => {
    setFilter({ showingLocked: !filter.showingLocked });
  }, [filter.showingLocked, setFilter]);

  return (
    <aside className="w-60 h-full flex flex-col bg-bg-panel border-r border-border-solid overflow-y-auto">
      {/* Logo + Title */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border-solid">
        <Camera className="w-6 h-6 text-accent" />
        <span className="text-lg font-bold text-text-primary tracking-tight">
          PeakPick
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col px-2 py-3 gap-1">
        <button
          className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-surface transition-colors"
          onClick={() => setFilter({ mode: "all" })}
        >
          <span>照片库</span>
          <span className="text-text-quaternary text-xs">{photoCount}</span>
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-surface transition-colors"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>导入照片</span>
        </button>
      </nav>

      {/* Date Range Filter */}
      <div className="px-3 py-3 border-t border-border-solid">
        <div className="text-xs font-medium text-text-tertiary mb-2 uppercase tracking-wider">
          日期范围
        </div>
        <div className="flex flex-col gap-1.5 mb-2">
          <label className="text-[11px] text-text-quaternary">开始</label>
          <input
            type="date"
            value={formatDate(dateRange.start)}
            onChange={(e) =>
              setDateRange({
                ...dateRange,
                start: new Date(e.target.value),
              })
            }
            className="bg-bg-surface text-text-secondary text-xs border border-border-solid rounded px-2 py-1.5 w-full"
          />
          <label className="text-[11px] text-text-quaternary">结束</label>
          <input
            type="date"
            value={formatDate(dateRange.end)}
            onChange={(e) =>
              setDateRange({
                ...dateRange,
                end: new Date(e.target.value),
              })
            }
            className="bg-bg-surface text-text-secondary text-xs border border-border-solid rounded px-2 py-1.5 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              className="text-[11px] px-2 py-1 rounded bg-bg-surface text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary transition-colors"
              onClick={() => handleDatePreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score Filter */}
      <div className="px-3 py-3 border-t border-border-solid">
        <div className="text-xs font-medium text-text-tertiary mb-2 uppercase tracking-wider">
          评分筛选
        </div>
        <nav className="flex flex-col gap-0.5">
          {SCORE_FILTERS.map((sf) => (
            <button
              key={sf.value}
              className={`text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter.scoreThreshold === sf.value
                  ? "bg-accent/20 text-accent-hover"
                  : "text-text-secondary hover:bg-bg-surface"
              }`}
              onClick={() => handleScoreFilter(sf.value)}
            >
              {sf.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Links */}
      <div className="px-3 py-3 border-t border-border-solid mt-auto">
        <nav className="flex flex-col gap-1">
          <button
            className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors ${
              filter.showingDismissed
                ? "bg-warning/10 text-warning"
                : "text-text-secondary hover:bg-bg-surface"
            }`}
            onClick={handleDismissedClick}
          >
            <span>已忽略</span>
            <span className="text-text-quaternary text-xs">
              {dismissedCount}
            </span>
          </button>
          <button
            className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors ${
              filter.showingLocked
                ? "bg-accent/10 text-accent-hover"
                : "text-text-secondary hover:bg-bg-surface"
            }`}
            onClick={handleLockedClick}
          >
            <span>已锁定</span>
            <span className="text-text-quaternary text-xs">{lockedCount}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
