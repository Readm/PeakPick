import { create } from "zustand";
import type { Photo, FilterState, DateRange } from "./types";

function mockDates() {
  const dates: Date[] = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(2026, 0, 1);
    d.setDate(d.getDate() + Math.floor(Math.random() * 125));
    dates.push(d);
  }
  return dates;
}



function generateMockPhotos(): Photo[] {
  const dates = mockDates();
  const photos: Photo[] = [];
  for (let i = 0; i < 84; i++) {
    const score = Math.min(Math.round((Math.random() * 3.5 + 1) * 10) / 10, 5);
    const isDismissed = Math.random() > 0.85;
    const locked = Math.random() > 0.92;
    photos.push({
      id: i,
      filename: `DSC_${String(10023 + i).padStart(5, "0")}.NEF`,
      filepath: `/photos/${String(10023 + i).padStart(5, "0")}.nef`,
      score,
      status: isDismissed ? "dismissed" : "pending",
      locked,
      selected: false,
      group: null,
      date: dates[i].toISOString().slice(0, 10),
      dateObj: dates[i],
      width: 6000,
      height: 4000,
      fileSize: 24_300_000,
    });
  }
  photos.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  photos.forEach((p, i) => {
    p.id = i;
  });
  // Give last 6 photos score 5.0
  for (let i = 0; i < 6; i++) {
    photos[photos.length - 1 - i].score = 5.0;
    photos[photos.length - 1 - i].status = "pending";
  }
  return photos;
}

export interface PhotoStore {
  photos: Photo[];
  filter: FilterState;
  dateRange: DateRange;
  detailIndex: number | null;
  importOpen: boolean;
  detailOpen: boolean;
  top5Open: boolean;

  // Actions
  setPhotos: (photos: Photo[]) => void;
  updateScore: (id: number, newScore: number) => void;
  toggleLock: (id: number) => void;
  setStatus: (id: number, status: "pending" | "kept" | "dismissed") => void;
  toggleSelect: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  batchDismiss: () => void;
  batchKeep: () => void;
  batchToggleLock: () => void;
  selectTop9: () => void;
  batchDeleteLow: () => void;
  setFilter: (partial: Partial<FilterState>) => void;
  setDateRange: (range: DateRange) => void;
  openDetail: (id: number) => void;
  closeDetail: () => void;
  navigateDetail: (dir: number) => void;
  setImportOpen: (open: boolean) => void;
  toggleTop5: () => void;
}

export const usePhotoStore = create<PhotoStore>((set) => ({
  photos: generateMockPhotos(),
  filter: {
    mode: "pending",
    scoreThreshold: 1,
    showingDismissed: false,
    showingLocked: false,
    searchQuery: "",
  },
  dateRange: {
    start: new Date(2026, 0, 1),
    end: new Date(2026, 4, 5),
  },
  detailIndex: null,
  importOpen: false,
  detailOpen: false,
  top5Open: false,

  setPhotos: (photos) => set({ photos }),

  updateScore: (id, newScore) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, score: newScore } : p
      ),
    })),

  toggleLock: (id) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, locked: !p.locked } : p
      ),
    })),

  setStatus: (id, status) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    })),

  toggleSelect: (id) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, selected: !p.selected } : p
      ),
    })),

  selectAll: () =>
    set((state) => ({
      photos: state.photos.map((p) => ({ ...p, selected: true })),
    })),

  clearSelection: () =>
    set((state) => ({
      photos: state.photos.map((p) => ({ ...p, selected: false })),
    })),

  batchDismiss: () =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.selected && !p.locked ? { ...p, status: "dismissed", selected: false } : p
      ),
    })),

  batchKeep: () =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.selected ? { ...p, status: "kept", selected: false } : p
      ),
    })),

  batchToggleLock: () =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.selected ? { ...p, locked: !p.locked, selected: false } : p
      ),
    })),

  selectTop9: () =>
    set((state) => {
      const sorted = [...state.photos]
        .filter((p) => p.status !== "dismissed")
        .sort((a, b) => b.score - a.score);
      const topIds = new Set(sorted.slice(0, 9).map((p) => p.id));
      return {
        photos: state.photos.map((p) => ({
          ...p,
          selected: topIds.has(p.id),
        })),
      };
    }),

  batchDeleteLow: () =>
    set((state) => {
      const threshold = state.filter.scoreThreshold;
      return {
        photos: state.photos.filter(
          (p) => !(p.score < threshold && !p.locked && p.status !== "dismissed")
        ),
      };
    }),

  setFilter: (partial) =>
    set((state) => ({
      filter: { ...state.filter, ...partial },
    })),

  setDateRange: (range) => set({ dateRange: range }),

  openDetail: (id) =>
    set((state) => ({
      detailIndex: state.photos.findIndex((p) => p.id === id),
      detailOpen: true,
    })),

  closeDetail: () => set({ detailOpen: false, detailIndex: null }),

  navigateDetail: (dir) =>
    set((state) => {
      if (state.detailIndex === null) return state;
      const newIdx = state.detailIndex + dir;
      if (newIdx >= 0 && newIdx < state.photos.length) {
        return { detailIndex: newIdx };
      }
      return state;
    }),

  setImportOpen: (open) => set({ importOpen: open }),

  toggleTop5: () => set((state) => ({ top5Open: !state.top5Open })),
}));
