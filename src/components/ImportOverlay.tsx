import { useCallback, useState } from "react";
import { Upload, X, Check, Loader2 } from "lucide-react";
import { usePhotoStore } from "../store";
import { selectFolder } from "../tauri";
import { scanImport, confirmImport } from "../api";

export function ImportOverlay() {
  const importOpen = usePhotoStore((s) => s.importOpen);
  const setImportOpen = usePhotoStore((s) => s.setImportOpen);
  const loadPhotos = usePhotoStore((s) => s.loadPhotos);

  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [scanResult, setScanResult] = useState<{
    count: number;
    dateMin: string;
    dateMax: string;
  } | null>(null);
  const [scannedFiles, setScannedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleClickDropzone = useCallback(async () => {
    setError(null);
    const path = await selectFolder();
    if (!path) return;

    setSelectedPath(path);
    setScanning(true);

    const result = await scanImport(path);
    if ("error" in result) {
      setError(result.error);
      setScanning(false);
      return;
    }

    setScanResult({
      count: result.count,
      dateMin: result.date_range?.min || "",
      dateMax: result.date_range?.max || "",
    });
    setScannedFiles(result.files);
    setScanning(false);
  }, []);

  const handleCancel = useCallback(() => {
    setImportOpen(false);
    setScanResult(null);
    setScannedFiles([]);
    setSelectedPath("");
    setError(null);
  }, [setImportOpen]);

  const handleConfirm = useCallback(async () => {
    if (!selectedPath || scannedFiles.length === 0) return;
    setImporting(true);
    setError(null);

    const result = await confirmImport(selectedPath, scannedFiles);
    if ("error" in result) {
      setError(result.error);
      setImporting(false);
      return;
    }

    setImportOpen(false);
    setScanResult(null);
    setScannedFiles([]);
    setSelectedPath("");
    setImporting(false);
    loadPhotos();
  }, [selectedPath, scannedFiles, setImportOpen, loadPhotos]);

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
            onClick={scanning || importing ? undefined : handleClickDropzone}
          >
            {scanning ? (
              <>
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-2" />
                <span className="text-sm text-text-tertiary">扫描中...</span>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-text-quaternary mb-2" />
                <span className="text-sm text-text-tertiary">
                  {scanResult ? "重新选择文件夹" : "点击选择文件夹"}
                </span>
                <span className="text-[11px] text-text-quaternary mt-1">
                  支持 NEF/RAW/JPEG
                </span>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/30">
              <span className="text-xs text-danger">{error}</span>
            </div>
          )}

          {/* Scan results */}
          {scanResult && !error && (
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
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            disabled={!scanResult || importing || !!error}
            onClick={handleConfirm}
          >
            {importing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> 导入中...</>
            ) : (
              "确认导入"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
