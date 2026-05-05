import { useMemo, useCallback } from "react";
import { Layers, Star } from "lucide-react";
import type { Photo } from "../types";
import { usePhotoStore } from "../store";

/** Hash string to color */
function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 35%)`;
}

interface SimilarGroupProps {
  photo: Photo;
}

export function SimilarGroup({ photo }: SimilarGroupProps) {
  const photos = usePhotoStore((s) => s.photos);
  const openDetail = usePhotoStore((s) => s.openDetail);

  const group = photo.group;

  const groupMembers = useMemo(() => {
    if (!group) return [];
    return photos
      .filter((p) => p.group?.groupId === group.groupId)
      .sort((a, b) => (b.group?.isHighest ? 1 : 0) - (a.group?.isHighest ? 1 : 0));
  }, [photos, group]);

  const handleMemberClick = useCallback(
    (id: number) => {
      openDetail(id);
    },
    [openDetail]
  );

  if (!group || groupMembers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border-solid overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-group-bg/50 border-b border-border-solid">
        <Layers className="w-3.5 h-3.5 text-group-accent" />
        <span className="text-xs font-medium text-text-secondary truncate flex-1">
          {group.desc || `相似组 #${group.groupId}`}
        </span>
        <span className="text-[11px] text-text-quaternary">
          {groupMembers.length} 张
        </span>
      </div>

      {/* Member grid */}
      <div className="p-2">
        <div className="grid grid-cols-5 gap-1">
          {groupMembers.map((m) => {
            const isCurrent = m.id === photo.id;
            const isBest = m.group?.isHighest;
            return (
              <button
                key={m.id}
                className={`relative aspect-square rounded overflow-hidden transition-all cursor-pointer ${
                  isCurrent
                    ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-panel"
                    : isBest
                      ? "ring-1 ring-warning"
                      : "border border-border-solid hover:border-accent/50"
                }`}
                onClick={() => handleMemberClick(m.id)}
              >
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: hashColor(m.filepath) }}
                />
                {isBest && (
                  <Star className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-warning" />
                )}
                {isCurrent && (
                  <div className="absolute inset-0 bg-accent/10 border-2 border-accent rounded" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
