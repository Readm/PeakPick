import { useMemo } from "react";
import { ImageOff } from "lucide-react";
import { usePhotoStore } from "../store";
import { formatScore, scoreBase } from "../lib/score";
import { PhotoCard } from "./PhotoCard";

/** Get filtered photos based on current store filter state */
function useFilteredPhotos() {
  const photos = usePhotoStore((s) => s.photos);
  const filter = usePhotoStore((s) => s.filter);

  return useMemo(() => {
    return photos.filter((p) => {
      // Mode filter
      if (filter.mode !== "all" && p.status !== filter.mode) return false;

      // Dismissed visibility
      if (!filter.showingDismissed && p.status === "dismissed") return false;

      // Locked visibility
      if (!filter.showingLocked && p.locked) return false;

      // Score threshold
      const base = scoreBase(formatScore(p.score));
      if (base < filter.scoreThreshold) return false;

      // Search query
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        if (
          !p.filename.toLowerCase().includes(q) &&
          !p.filepath.toLowerCase().includes(q)
        )
          return false;
      }

      return true;
    });
  }, [photos, filter]);
}

export function PhotoGrid() {
  const filtered = useFilteredPhotos();
  const openDetail = usePhotoStore((s) => s.openDetail);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-3">
        <ImageOff className="w-12 h-12" />
        <span className="text-sm">没有符合条件的照片</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
      {filtered.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} onOpen={openDetail} />
      ))}
    </div>
  );
}
