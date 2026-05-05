import { useCallback, useEffect, useState } from "react";
import { Check, Lock, Unlock, Layers } from "lucide-react";
import type { Photo } from "../types";
import { usePhotoStore } from "../store";
import { formatScore, getBaseVariants, parseLabel } from "../lib/score";
import { fetchThumbnail } from "../api";

interface PhotoCardProps {
  photo: Photo;
  onOpen: (id: number) => void;
}

/** Hash a string to a hex color for placeholder backgrounds */
function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 35%)`;
}

export function PhotoCard({ photo, onOpen }: PhotoCardProps) {
  const toggleSelect = usePhotoStore((s) => s.toggleSelect);
  const toggleLock = usePhotoStore((s) => s.toggleLock);
  const updateScore = usePhotoStore((s) => s.updateScore);

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchThumbnail(photo.id);
      if (cancelled) return;
      if (!("error" in result) && result.thumbnail) {
        setThumbnailUrl(`data:image/jpeg;base64,${result.thumbnail}`);
      } else {
        setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [photo.id]);

  const bg = hashColor(photo.filepath);
  const label = formatScore(photo.score);
  const base = parseInt(label === "--" ? "3" : label) || 3;
  const variants = getBaseVariants(base);

  const cycleScore = useCallback(() => {
    const currentLabel = formatScore(photo.score);
    const idx = variants.indexOf(currentLabel as any);
    const nextIdx = (idx + 1) % variants.length;
    const nextLabel = variants[nextIdx];
    const newScore = parseLabel(nextLabel);
    updateScore(photo.id, newScore);
  }, [photo.score, photo.id, variants, updateScore]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelect(photo.id);
  };

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLock(photo.id);
  };

  const handleCardClick = () => {
    onOpen(photo.id);
  };

  const isDismissed = photo.status === "dismissed";

  return (
    <div
      className="relative group rounded-lg overflow-hidden border border-border-standard cursor-pointer transition-all duration-150 hover:border-accent/40"
      onClick={handleCardClick}
    >
      {/* Thumbnail or placeholder */}
      <div
        className="w-full aspect-[3/2] flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: loadError || !thumbnailUrl ? bg : undefined }}
      >
        {thumbnailUrl && !loadError ? (
          <img
            src={thumbnailUrl}
            alt={photo.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-text-quaternary text-xs select-none">
            {photo.filename}
          </span>
        )}
      </div>

      {/* Dismissed overlay */}
      {isDismissed && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-text-tertiary text-sm font-medium tracking-wider uppercase">
            已忽略
          </span>
        </div>
      )}

      {/* Score label overlay on hover */}
      <div
        className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-end justify-center pb-1"
        onClick={(e) => {
          e.stopPropagation();
          cycleScore();
        }}
      >
        <span className="text-xs font-semibold text-white bg-black/40 px-2 py-0.5 rounded cursor-pointer hover:bg-accent/60 transition-colors">
          {label}
        </span>
      </div>

      {/* Checkbox top-left */}
      <div
        className="absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 border-white/40 flex items-center justify-center cursor-pointer bg-black/20 hover:bg-black/40 transition-colors"
        onClick={handleCheckboxClick}
      >
        {photo.selected && <Check className="w-3 h-3 text-accent-hover" />}
      </div>

      {/* Lock icon top-right */}
      <div
        className="absolute top-1.5 right-1.5 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        onClick={handleLockClick}
      >
        {photo.locked ? (
          <Lock className="w-3.5 h-3.5 text-warning" />
        ) : (
          <Unlock className="w-3.5 h-3.5 text-text-quaternary hover:text-text-secondary" />
        )}
      </div>

      {/* Group badge */}
      {photo.group && (
        <div className="absolute top-1.5 left-8 flex items-center gap-1 bg-group-bg text-group-accent text-[10px] px-1.5 py-0.5 rounded">
          <Layers className="w-2.5 h-2.5" />
          <span>{photo.group.groupId}</span>
        </div>
      )}

      {/* Kept badge */}
      {photo.status === "kept" && (
        <div className="absolute bottom-1.5 left-1.5 bg-success/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
          保留
        </div>
      )}
    </div>
  );
}
