import { useMemo, useCallback } from "react";
import {
  Star,
  Lock,
  Unlock,
  EyeOff,
  CheckCircle,
  Keyboard,
  Image,
} from "lucide-react";
import type { Photo } from "../types";
import { usePhotoStore } from "../store";
import { formatScore, getBaseVariants, parseLabel } from "../lib/score";
import { ScoreDistribution } from "./ScoreDistribution";
import { SimilarGroup } from "./SimilarGroup";
import { Top5Collapsible } from "./Top5Collapsible";

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface DetailSidebarProps {
  photo: Photo;
  position: string;
}

export function DetailSidebar({ photo, position }: DetailSidebarProps) {
  const updateScore = usePhotoStore((s) => s.updateScore);
  const toggleLock = usePhotoStore((s) => s.toggleLock);
  const setStatus = usePhotoStore((s) => s.setStatus);

  const label = formatScore(photo.score);
  const base = parseInt(label === "--" ? "3" : label) || 3;
  const variants = getBaseVariants(base);

  const cycleScore = useCallback(() => {
    const idx = variants.indexOf(label as any);
    const nextIdx = (idx + 1) % variants.length;
    const nextLabel = variants[nextIdx];
    const newScore = parseLabel(nextLabel);
    updateScore(photo.id, newScore);
  }, [photo.id, photo.score, label, variants, updateScore]);

  // Determine modifier indicator
  const hasPlus = label.includes("+");
  const hasMinus = label.includes("-");
  const modifier = hasPlus ? "+" : hasMinus ? "−" : null;

  // Star rating (1-5, partial for minus)
  const starBase = parseInt(label === "--" ? "3" : label) || 3;
  const isMinus = label.includes("-");
  const isPlus = label.includes("+");

  const stars = useMemo(() => {
    const result: ("full" | "half" | "empty")[] = [];
    for (let i = 1; i <= 5; i++) {
      if (i < starBase) result.push("full");
      else if (i === starBase && isMinus) result.push("half");
      else if (i <= starBase && isPlus) result.push("full");
      else if (i === starBase) result.push("full");
      else result.push("empty");
    }
    return result;
  }, [starBase, isMinus, isPlus]);

  const handleToggleLock = useCallback(() => {
    toggleLock(photo.id);
  }, [photo.id, toggleLock]);

  const handleDismiss = useCallback(() => {
    setStatus(photo.id, "dismissed");
  }, [photo.id, setStatus]);

  const handleKeep = useCallback(() => {
    setStatus(photo.id, "kept");
  }, [photo.id, setStatus]);

  return (
    <div className="w-[260px] h-full flex flex-col bg-bg-panel border-l border-border-solid overflow-y-auto">
      {/* Score section */}
      <div className="px-4 pt-4 pb-3 border-b border-border-solid">
        <button
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-bg-surface hover:bg-bg-elevated transition-colors cursor-pointer"
          onClick={cycleScore}
        >
          <span className="text-3xl font-bold text-accent">{label}</span>
          {modifier && (
            <span
              className={`text-lg font-bold ${
                modifier === "+" ? "text-success" : "text-danger"
              }`}
            >
              {modifier}
            </span>
          )}
        </button>

        {/* Star rating */}
        <div className="flex items-center justify-center gap-0.5 mt-2">
          {stars.map((s, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                s === "full"
                  ? "text-warning fill-warning"
                  : s === "half"
                    ? "text-warning"
                    : "text-text-quaternary"
              }`}
            />
          ))}
          {isMinus && (
            <span className="text-[10px] text-text-quaternary ml-1">-</span>
          )}
          {isPlus && (
            <span className="text-[10px] text-success ml-1">+</span>
          )}
        </div>
      </div>

      {/* Score Distribution */}
      <div className="px-3 py-3 border-b border-border-solid">
        <ScoreDistribution />
      </div>

      {/* Similar Group */}
      <div className="px-3 py-3 border-b border-border-solid">
        <SimilarGroup photo={photo} />
      </div>

      {/* Top 5 Collapsible */}
      <div className="px-3 py-2 border-b border-border-solid">
        <Top5Collapsible />
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 border-b border-border-solid">
        <div className="flex items-center gap-1.5 mb-2">
          <Image className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="text-xs font-medium text-text-secondary">
            文件信息
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-quaternary">文件名</span>
            <span className="text-text-secondary truncate max-w-[140px] text-right">
              {photo.filename}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-quaternary">位置</span>
            <span className="text-text-secondary">{position}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-quaternary">日期</span>
            <span className="text-text-secondary">{photo.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-quaternary">分辨率</span>
            <span className="text-text-secondary">
              {photo.width} × {photo.height}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-quaternary">大小</span>
            <span className="text-text-secondary">
              {formatFileSize(photo.fileSize)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-quaternary">状态</span>
            <span
              className={`${
                photo.status === "kept"
                  ? "text-success"
                  : photo.status === "dismissed"
                    ? "text-danger"
                    : "text-text-secondary"
              }`}
            >
              {photo.status === "kept"
                ? "保留"
                : photo.status === "dismissed"
                  ? "已忽略"
                  : "待处理"}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border border-border-solid text-text-secondary hover:bg-bg-surface transition-colors"
            onClick={handleKeep}
          >
            <CheckCircle className="w-3.5 h-3.5 text-success" />
            保留
          </button>
          <button
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              photo.locked
                ? "border-warning/40 text-warning bg-warning/10"
                : "border-border-solid text-text-secondary hover:bg-bg-surface"
            }`}
            onClick={handleToggleLock}
          >
            {photo.locked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {photo.locked ? "已锁" : "锁定"}
          </button>
          <button
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border border-border-solid text-text-secondary hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
            onClick={handleDismiss}
          >
            <EyeOff className="w-3.5 h-3.5" />
            忽略
          </button>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="px-4 py-3 mt-auto border-t border-border-solid">
        <div className="flex items-center gap-1.5 mb-2">
          <Keyboard className="w-3 h-3 text-text-quaternary" />
          <span className="text-[10px] text-text-quaternary tracking-wider uppercase">
            快捷键
          </span>
        </div>
        <div className="flex flex-col gap-1 text-[10px] text-text-quaternary">
          <div className="flex justify-between">
            <span>← →</span>
            <span>导航</span>
          </div>
          <div className="flex justify-between">
            <span>1-5</span>
            <span>设置评分</span>
          </div>
          <div className="flex justify-between">
            <span>L</span>
            <span>锁定/解锁</span>
          </div>
          <div className="flex justify-between">
            <span>D</span>
            <span>忽略</span>
          </div>
          <div className="flex justify-between">
            <span>Esc</span>
            <span>关闭</span>
          </div>
        </div>
      </div>
    </div>
  );
}
