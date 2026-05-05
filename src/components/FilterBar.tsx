import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { usePhotoStore } from "../store";
import { formatScore } from "../lib/score";

const CHIP_OPTIONS: { label: string; mode: string; warning?: boolean }[] = [
  { label: "全部", mode: "all" },
  { label: "待处理", mode: "pending" },
  { label: "保留", mode: "kept" },
  { label: "已忽略", mode: "dismissed", warning: true },
  { label: "锁定", mode: "locked" },
];

export function FilterBar() {
  const filter = usePhotoStore((s) => s.filter);
  const setFilter = usePhotoStore((s) => s.setFilter);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter({ searchQuery: e.target.value });
    },
    [setFilter]
  );

  const handleClearSearch = useCallback(() => {
    setFilter({ searchQuery: "" });
  }, [setFilter]);

  const handleThresholdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter({ scoreThreshold: parseInt(e.target.value) || 1 });
    },
    [setFilter]
  );

  const handleChipClick = useCallback(
    (mode: string) => {
      if (mode === "dismissed") {
        setFilter({ showingDismissed: !filter.showingDismissed });
      } else if (mode === "locked") {
        setFilter({ showingLocked: !filter.showingLocked });
      } else {
        setFilter({ mode: mode as "all" | "pending" | "kept" });
      }
    },
    [filter.showingDismissed, filter.showingLocked, setFilter]
  );

  const isActive = (opt: (typeof CHIP_OPTIONS)[number]) => {
    if (opt.mode === "dismissed") return filter.showingDismissed;
    if (opt.mode === "locked") return filter.showingLocked;
    return filter.mode === opt.mode;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-panel border-b border-border-solid">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-quaternary" />
        <input
          type="text"
          placeholder="文件名搜索"
          value={filter.searchQuery}
          onChange={handleSearchChange}
          className="w-full bg-bg-surface text-text-secondary text-sm border border-border-solid rounded-md pl-8 pr-7 py-1.5 placeholder:text-text-quaternary focus:outline-none focus:border-accent/50"
        />
        {filter.searchQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={handleClearSearch}
          >
            <X className="w-3.5 h-3.5 text-text-quaternary hover:text-text-secondary" />
          </button>
        )}
      </div>

      {/* Score threshold slider */}
      <div className="flex items-center gap-2 min-w-[180px]">
        <span className="text-xs text-text-tertiary whitespace-nowrap">
          阈值:
        </span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={filter.scoreThreshold}
          onChange={handleThresholdChange}
          className="w-20"
        />
        <span className="text-xs font-medium text-accent w-8 text-center">
          {formatScore(filter.scoreThreshold)}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        {CHIP_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              isActive(opt)
                ? opt.warning
                  ? "bg-warning/20 text-warning"
                  : "bg-accent/20 text-accent-hover"
                : "bg-bg-surface text-text-tertiary hover:bg-bg-elevated hover:text-text-secondary"
            }`}
            onClick={() => handleChipClick(opt.mode)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
