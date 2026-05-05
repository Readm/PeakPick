import { Folder, CalendarDays, Upload } from "lucide-react";
import { usePhotoStore } from "../store";
import { formatDateRange } from "../lib/dates";

export function Header() {
  const photos = usePhotoStore((s) => s.photos);
  const dateRange = usePhotoStore((s) => s.dateRange);
  const setImportOpen = usePhotoStore((s) => s.setImportOpen);
  const filter = usePhotoStore((s) => s.filter);

  const viewTitle =
    filter.mode === "all"
      ? "全部照片"
      : filter.mode === "pending"
        ? "待处理"
        : "保留";

  const folderBadge = photos.length > 0 ? photos[0].filepath.split("/").slice(0, -1).join("/") || "根目录" : "根目录";

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-bg-panel border-b border-border-solid">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-text-primary">{viewTitle}</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-text-tertiary bg-bg-surface px-2 py-0.5 rounded">
            <Folder className="w-3 h-3" />
            <span className="truncate max-w-[160px]">{folderBadge}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-tertiary bg-bg-surface px-2 py-0.5 rounded">
            <CalendarDays className="w-3 h-3" />
            <span className="truncate max-w-[200px]">
              {formatDateRange(dateRange.start, dateRange.end)}
            </span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-quaternary">
          PeakPick v0.1 · score: v4-flash
        </span>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="w-3.5 h-3.5" />
          导入照片
        </button>
      </div>
    </header>
  );
}
