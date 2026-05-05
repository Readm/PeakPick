import { PhotoGrid } from "./components/PhotoGrid";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { Toolbar } from "./components/Toolbar";
import { ImportOverlay } from "./components/ImportOverlay";
import { DetailOverlay } from "./components/DetailOverlay";
import "./App.css";

function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <FilterBar />
        <div className="flex-1 overflow-y-auto p-4" id="main-content">
          <PhotoGrid />
        </div>
        <Toolbar />
      </div>

      {/* Overlays */}
      <ImportOverlay />
      <DetailOverlay />
    </div>
  );
}

export default App;
