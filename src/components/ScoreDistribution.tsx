import { useMemo, useCallback } from "react";
import { usePhotoStore } from "../store";
import { formatScore } from "../lib/score";

export function ScoreDistribution() {
  const photos = usePhotoStore((s) => s.photos);
  const filter = usePhotoStore((s) => s.filter);
  const setFilter = usePhotoStore((s) => s.setFilter);

  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const p of photos) {
      const label = formatScore(p.score);
      if (label === "--") continue;
      const base = parseInt(label);
      if (counts[base] !== undefined) counts[base]++;
    }
    const maxCount = Math.max(...Object.values(counts), 1);
    return [1, 2, 3, 4, 5].map((base) => ({
      base,
      count: counts[base],
      pct: maxCount > 0 ? (counts[base] / maxCount) * 100 : 0,
    }));
  }, [photos]);

  const activeBase = useMemo(() => {
    const label = formatScore(filter.scoreThreshold);
    return label === "--" ? 1 : parseInt(label) || 1;
  }, [filter.scoreThreshold]);

  const handleBarClick = useCallback(
    (base: number) => {
      setFilter({ scoreThreshold: base });
    },
    [setFilter]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {distribution.map((d) => {
        const isActive = d.base === activeBase;
        return (
          <button
            key={d.base}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors hover:bg-bg-surface ${
              isActive ? "bg-accent/10" : ""
            }`}
            onClick={() => handleBarClick(d.base)}
          >
            <span className="text-xs font-medium text-text-tertiary w-4 text-right">
              {d.base}
            </span>
            <div className="flex-1 h-4 bg-bg-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isActive ? "bg-accent" : "bg-bg-elevated"
                }`}
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <span className="text-xs text-text-quaternary w-6 text-right">
              {d.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
