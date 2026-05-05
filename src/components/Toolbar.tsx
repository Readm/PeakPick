import { useMemo, useCallback } from "react";
import {
  Trash2,
  Lock,
  EyeOff,
  CheckSquare,
  Square,
  Star,
  Zap,
} from "lucide-react";
import { usePhotoStore } from "../store";

export function Toolbar() {
  const photos = usePhotoStore((s) => s.photos);
  const selectAll = usePhotoStore((s) => s.selectAll);
  const clearSelection = usePhotoStore((s) => s.clearSelection);
  const batchDismiss = usePhotoStore((s) => s.batchDismiss);
  const batchKeep = usePhotoStore((s) => s.batchKeep);
  const batchToggleLock = usePhotoStore((s) => s.batchToggleLock);
  const selectTop9 = usePhotoStore((s) => s.selectTop9);
  const batchDeleteLow = usePhotoStore((s) => s.batchDeleteLow);

  const selectedCount = useMemo(
    () => photos.filter((p) => p.selected).length,
    [photos]
  );

  const stats = useMemo(() => {
    const total = photos.length;
    const active = photos.filter((p) => p.status !== "dismissed" && !p.locked)
      .length;
    const dismissed = photos.filter((p) => p.status === "dismissed").length;
    const locked = photos.filter((p) => p.locked).length;
    const avgScore =
      total > 0
        ? photos.reduce((s, p) => s + p.score, 0) / total
        : 0;
    return { total, active, dismissed, locked, avgScore };
  }, [photos]);

  const hasSelection = selectedCount > 0;

  const handleSelectAll = useCallback(() => {
    if (selectedCount === photos.length) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [selectedCount, photos.length, selectAll, clearSelection]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-bg-panel border-b border-border-solid">
      {/* Left side */}
      <div className="flex items-center gap-2">
        {/* Select All / Clear */}
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-surface transition-colors"
          onClick={handleSelectAll}
        >
          {selectedCount === photos.length && photos.length > 0 ? (
            <CheckSquare className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          {selectedCount === photos.length ? "取消全选" : "全选"}
        </button>

        {/* Selected count */}
        {hasSelection && (
          <span className="text-xs text-text-tertiary px-2">
            已选 {selectedCount} 张
          </span>
        )}

        <div className="w-px h-5 bg-border-solid mx-1" />

        {/* Batch actions */}
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!hasSelection}
          onClick={batchDismiss}
        >
          <EyeOff className="w-3.5 h-3.5" />
          忽略选中
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!hasSelection}
          onClick={batchKeep}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          保留选中
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!hasSelection}
          onClick={batchToggleLock}
        >
          <Lock className="w-3.5 h-3.5" />
          锁定选中
        </button>

        <div className="w-px h-5 bg-border-solid mx-1" />

        {/* One-click select top 9 */}
        <button
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          onClick={selectTop9}
        >
          <Zap className="w-3.5 h-3.5" />
          一键选9图
        </button>

        {/* Delete below threshold */}
        <button
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
          onClick={batchDeleteLow}
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除低于阈值
        </button>
      </div>

      {/* Right side stats */}
      <div className="flex items-center gap-3 text-xs text-text-tertiary">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-accent" />
          {stats.avgScore.toFixed(1)}
        </span>
        <span className="text-text-quaternary">|</span>
        <span>
          总计 <span className="text-text-secondary">{stats.total}</span>
        </span>
        <span>
          活跃 <span className="text-text-secondary">{stats.active}</span>
        </span>
        <span>
          已忽略 <span className="text-text-secondary">{stats.dismissed}</span>
        </span>
        <span>
          锁定 <span className="text-text-secondary">{stats.locked}</span>
        </span>
      </div>
    </div>
  );
}
