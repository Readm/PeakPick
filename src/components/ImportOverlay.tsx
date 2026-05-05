import { useCallback, useState } from "react";
import { Upload, X, Check } from "lucide-react";
import { usePhotoStore } from "../store";

export function ImportOverlay() {
  const importOpen = usePhotoStore((s) => s.importOpen);
  const setImportOpen = usePhotoStore((s) => s.setImportOpen);

  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<{
    count: number;
    dateMin: string;
    dateMax: string;
  } | null>(null);

  const handleClickDropzone = useCallback(() => {
    // Simulate scanning
    setScanResult({
      count: 73,
      dateMin: "2026-01-12",
      dateMax: "2026-04-28",
    });
    setScanned(true);
  }, []);

  const handleCancel = useCallback(() => {
    setImportOpen(false);
    setScanned(false);
    setScanResult(null);
  }, [setImportOpen]);

  const handleConfirm = useCallback(() => {
    // In a real app, this would trigger the actual import
    setImportOpen(false);
    setScanned(false);
    setScanResult(null);
  }, [setImportOpen]);

  if (!importOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] bg-bg-panel rounded-xl border border-border-solid shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-solid">
          <h2 className="text-base font-semibold text-text-primary">
            导入照片
          </h2>
          <button
            className="p-1 rounded hover:bg-bg-surface transition-colors"
            onClick={handleCancel}
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Dropzone */}
          <div
            className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed border-border-standard bg-bg-surface cursor-pointer hover:border-accent/40 hover:bg-bg-elevated transition-all"
            onClick={handleClickDropzone}
          >
            <Upload className="w-10 h-10 text-text-quaternary mb-2" />
            <span className="text-sm text-text-tertiary">
              {scanned ? "扫描完成" : "点击选择文件夹"}
            </span>
            <span className="text-[11px] text-text-quaternary mt-1">
              支持 NEF/RAW/JPEG
            </span>
          </div>

          {/* Scan results */}
          {scanned && scanResult && (
            <div className="mt-4 p-3 rounded-lg bg-bg-surface border border-border-solid">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-text-secondary">
                  扫描结果
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-text-tertiary">文件数量:</span>
                <span className="text-text-secondary text-right">
                  {scanResult.count} 张
                </span>
                <span className="text-text-tertiary">拍摄日期:</span>
                <span className="text-text-secondary text-right">
                  {scanResult.dateMin} ~ {scanResult.dateMax}
                </span>
                <span className="text-text-tertiary">格式:</span>
                <span className="text-text-secondary text-right">
                  NEF + JPEG
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-solid bg-bg-surface/50">
          <button
            className="px-4 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-surface transition-colors"
            onClick={handleCancel}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!scanned}
            onClick={handleConfirm}
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
