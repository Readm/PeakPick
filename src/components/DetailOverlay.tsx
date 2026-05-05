import { useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Lock } from "lucide-react";
import { usePhotoStore } from "../store";
import { formatScore, getBaseVariants, parseLabel } from "../lib/score";
import { DetailSidebar } from "./DetailSidebar";

function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 35%)`;
}

export function DetailOverlay() {
  const detailOpen = usePhotoStore((s) => s.detailOpen);
  const detailIndex = usePhotoStore((s) => s.detailIndex);
  const photos = usePhotoStore((s) => s.photos);
  const closeDetail = usePhotoStore((s) => s.closeDetail);
  const navigateDetail = usePhotoStore((s) => s.navigateDetail);
  const updateScore = usePhotoStore((s) => s.updateScore);
  const toggleLock = usePhotoStore((s) => s.toggleLock);
  const setStatus = usePhotoStore((s) => s.setStatus);

  const photo = useMemo(() => {
    if (detailIndex === null || detailIndex < 0 || detailIndex >= photos.length)
      return null;
    return photos[detailIndex];
  }, [detailIndex, photos]);

  const position = useMemo(() => {
    if (detailIndex === null) return "";
    return `${detailIndex + 1}/${photos.length}`;
  }, [detailIndex, photos.length]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!detailOpen || !photo) return;

      switch (e.key) {
        case "Escape":
          closeDetail();
          break;
        case "ArrowLeft":
          navigateDetail(-1);
          break;
        case "ArrowRight":
          navigateDetail(1);
          break;
        case "l":
        case "L":
          toggleLock(photo.id);
          break;
        case "d":
        case "D":
          setStatus(photo.id, "dismissed");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          const newBase = parseInt(e.key);
          const label = formatScore(photo.score);
          const currentBase = parseInt(label === "--" ? "3" : label) || 3;
          if (currentBase === newBase) {
            // Cycle the variant
            const variants = getBaseVariants(newBase);
            const idx = variants.indexOf(label as any);
            const nextIdx = (idx + 1) % variants.length;
            const newLabel = variants[nextIdx];
            updateScore(photo.id, parseLabel(newLabel));
          } else {
            // Set to neutral of that base
            const variants = getBaseVariants(newBase);
            const neutral = variants[0];
            if (neutral) {
              updateScore(photo.id, parseLabel(neutral));
            }
          }
          break;
        }
      }
    },
    [detailOpen, photo, closeDetail, navigateDetail, toggleLock, setStatus, updateScore]
  );

  useEffect(() => {
    if (detailOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [detailOpen, handleKeyDown]);

  if (!detailOpen || !photo) return null;

  const bgColor = hashColor(photo.filepath);
  const hasPrev = detailIndex !== null && detailIndex > 0;
  const hasNext = detailIndex !== null && detailIndex < photos.length - 1;

  return (
    <div className="fixed inset-0 z-40 flex bg-black/95">
      {/* Main photo area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-bg-deep border-b border-border-solid">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-text-primary truncate">
              {photo.filename}
            </span>
            {photo.locked && (
              <span className="flex items-center gap-1 text-[11px] text-warning bg-warning/10 px-2 py-0.5 rounded">
                <Lock className="w-3 h-3" />
                已锁定
              </span>
            )}
            {photo.status === "kept" && (
              <span className="text-[11px] text-success bg-success/10 px-2 py-0.5 rounded">
                保留
              </span>
            )}
            {photo.status === "dismissed" && (
              <span className="text-[11px] text-danger bg-danger/10 px-2 py-0.5 rounded">
                已忽略
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-quaternary">{position}</span>
            <button
              className="p-1.5 rounded hover:bg-bg-surface transition-colors"
              onClick={closeDetail}
            >
              <X className="w-4 h-4 text-text-tertiary hover:text-text-primary" />
            </button>
          </div>
        </div>

        {/* Photo display area */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Left navigation arrow */}
          <button
            className={`absolute left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors ${
              hasPrev ? "opacity-60 hover:opacity-100" : "opacity-20 cursor-not-allowed"
            }`}
            onClick={() => hasPrev && navigateDetail(-1)}
            disabled={!hasPrev}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          {/* Photo placeholder */}
          <div
            className="max-w-[75%] max-h-[85%] aspect-[3/2] rounded-lg flex items-center justify-center shadow-2xl"
            style={{ backgroundColor: bgColor }}
          >
            <span className="text-text-quaternary text-sm select-none">
              {photo.filename}
            </span>
          </div>

          {/* Right navigation arrow */}
          <button
            className={`absolute right-[276px] z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors ${
              hasNext ? "opacity-60 hover:opacity-100" : "opacity-20 cursor-not-allowed"
            }`}
            onClick={() => hasNext && navigateDetail(1)}
            disabled={!hasNext}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Detail Sidebar */}
      <DetailSidebar photo={photo} position={position} />
    </div>
  );
}
