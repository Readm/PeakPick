import { useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { usePhotoStore } from "../store";
import { formatScore } from "../lib/score";

/** Hash string to color */
function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 35%)`;
}

export function Top5Collapsible() {
  const photos = usePhotoStore((s) => s.photos);
  const top5Open = usePhotoStore((s) => s.top5Open);
  const toggleTop5 = usePhotoStore((s) => s.toggleTop5);
  const openDetail = usePhotoStore((s) => s.openDetail);

  const topPhotos = useMemo(() => {
    return photos
      .filter((p) => {
        const label = formatScore(p.score);
        const base = parseInt(label === "--" ? "0" : label) || 0;
        return base >= 5;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // show up to 10
  }, [photos]);

  const handleThumbnailClick = useCallback(
    (id: number) => {
      openDetail(id);
    },
    [openDetail]
  );

  return (
    <div className="rounded-lg border border-border-solid overflow-hidden">
      {/* Collapsible header */}
      <button
        className="flex items-center justify-between w-full px-3 py-2 bg-bg-surface hover:bg-bg-elevated transition-colors"
        onClick={toggleTop5}
      >
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-warning" />
          <span className="text-xs font-medium text-text-secondary">
            高分精选
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-quaternary">
            {topPhotos.length}
          </span>
          {top5Open ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
          )}
        </div>
      </button>

      {/* Collapsible content */}
      {top5Open && (
        <div className="p-2">
          {topPhotos.length === 0 ? (
            <p className="text-xs text-text-quaternary text-center py-3">
              暂无 5 分照片
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {topPhotos.map((p) => (
                <button
                  key={p.id}
                  className="relative aspect-square rounded overflow-hidden border border-border-solid hover:border-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleThumbnailClick(p.id)}
                >
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: hashColor(p.filepath) }}
                  />
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold text-white bg-black/50 px-0.5 rounded">
                    {formatScore(p.score)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
