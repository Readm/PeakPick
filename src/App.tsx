import { useEffect } from "react";
import { PhotoGrid } from "./components/PhotoGrid";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { Toolbar } from "./components/Toolbar";
import { ImportOverlay } from "./components/ImportOverlay";
import { DetailOverlay } from "./components/DetailOverlay";
import { usePhotoStore } from "./store";
import "./App.css";

function App() {
  const initBackend = usePhotoStore((s) => s.initBackend);
  const loadPhotos = usePhotoStore((s) => s.loadPhotos);
  const loading = usePhotoStore((s) => s.loading);
  const error = usePhotoStore((s) => s.error);
  const backendConnected = usePhotoStore((s) => s.backendConnected);

  useEffect(() => {
    (async () => {
      const connected = await initBackend();
      if (connected) {
        await loadPhotos();
      }
    })();
  }, []);

  return (
    <div className="flex h-screen relative">
      {/* Backend status banner */}
      {!backendConnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-danger/90 text-white text-xs text-center py-1">
          ⚡ 后端未连接 — 请启动 ML 服务 (python run.sh)
        </div>
      )}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-accent/80 text-white text-xs text-center py-1">
          📂 加载中...
        </div>
      )}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-danger/80 text-white text-xs text-center py-1">
          ❌ {error}
        </div>
      )}

      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <FilterBar />
        <div className="flex-1 overflow-y-auto p-4" id="main-content">
          <PhotoGrid />
        </div>
        <Toolbar />
      </div>

      <ImportOverlay />
      <DetailOverlay />
    </div>
  );
}

export default App;
