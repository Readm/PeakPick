import { create } from "zustand";
import type { Photo, FilterState, DateRange } from "./types";
import {
  fetchPhotos,
  updateScore as apiUpdateScore,
  toggleLock as apiToggleLock,
  updateStatus as apiUpdateStatus,
  batchDelete as apiBatchDelete,
  batchUpdateStatus as apiBatchUpdateStatus,
  healthCheck,
  PhotoDTO,
} from "./api";

function dtoToPhoto(dto: PhotoDTO): Photo {
  return {
    id: dto.id,
    filename: dto.filename,
    filepath: dto.filepath,
    score: dto.score,
    status: dto.status,
    locked: dto.locked,
    selected: false,
    group: null,
    date: dto.date_taken || "",
    dateObj: dto.date_taken ? new Date(dto.date_taken) : new Date(),
    width: dto.width || 0,
    height: dto.height || 0,
    fileSize: dto.file_size || 0,
  };
}

export interface PhotoStore {
  photos: Photo[];
  filter: FilterState;
  dateRange: DateRange;
  detailIndex: number | null;
  importOpen: boolean;
  detailOpen: boolean;
  top5Open: boolean;
  loading: boolean;
  error: string | null;
  backendConnected: boolean;

  // Actions
  initBackend: () => Promise<boolean>;
  loadPhotos: () => Promise<void>;
  updateScore: (id: number, newScore: number) => Promise<void>;
  toggleLock: (id: number) => Promise<void>;
  setStatus: (id: number, status: "pending" | "kept" | "dismissed") => Promise<void>;
  toggleSelect: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  batchDismiss: () => Promise<void>;
  batchKeep: () => Promise<void>;
  batchToggleLock: () => Promise<void>;
  selectTop9: () => void;
  batchDeleteLow: () => Promise<void>;
  setFilter: (partial: Partial<FilterState>) => void;
  setDateRange: (range: DateRange) => void;
  openDetail: (id: number) => void;
  closeDetail: () => void;
  navigateDetail: (dir: number) => void;
  setImportOpen: (open: boolean) => void;
  toggleTop5: () => void;
  setError: (error: string | null) => void;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
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
  loading: false,
  error: null,
  backendConnected: false,

  initBackend: async () => {
    const result = await healthCheck();
    if ("error" in result) {
      set({ backendConnected: false });
      return false;
    }
    set({ backendConnected: true });
    return true;
  },

  loadPhotos: async () => {
    set({ loading: true, error: null });
    const params: Record<string, string> = {};
    const { filter } = get();
    if (filter.mode !== "all") params.status = filter.mode;
    if (filter.scoreThreshold > 1) params.score_min = String(filter.scoreThreshold);
    if (filter.searchQuery) params.search = filter.searchQuery;
    if (filter.showingLocked) params.locked = "true";

    const result = await fetchPhotos(params);
    if ("error" in result) {
      set({ loading: false, error: result.error });
      return;
    }
    set({
      photos: result.photos.map(dtoToPhoto),
      loading: false,
      error: null,
    });
  },

  updateScore: async (id, newScore) => {
    // Optimistic update
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, score: newScore } : p
      ),
    }));
    const result = await apiUpdateScore(id, newScore);
    if ("error" in result) {
      // Revert on failure by reloading
      get().loadPhotos();
    }
  },

  toggleLock: async (id) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, locked: !p.locked } : p
      ),
    }));
    const result = await apiToggleLock(id);
    if ("error" in result) {
      get().loadPhotos();
    }
  },

  setStatus: async (id, status) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    }));
    const result = await apiUpdateStatus(id, status);
    if ("error" in result) {
      get().loadPhotos();
    }
  },

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

  batchDismiss: async () => {
    const ids = get().photos.filter((p) => p.selected && !p.locked).map((p) => p.id);
    const result = await apiBatchUpdateStatus(ids, "dismissed");
    if ("error" in result) {
      get().loadPhotos();
      return;
    }
    get().loadPhotos();
  },

  batchKeep: async () => {
    const ids = get().photos.filter((p) => p.selected).map((p) => p.id);
    await apiBatchUpdateStatus(ids, "kept");
    get().loadPhotos();
  },

  batchToggleLock: async () => {
    const selected = get().photos.filter((p) => p.selected);
    // Toggle each
    for (const p of selected) {
      await apiToggleLock(p.id);
    }
    get().loadPhotos();
  },

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

  batchDeleteLow: async () => {
    const threshold = get().filter.scoreThreshold;
    const result = await apiBatchDelete(threshold);
    if ("error" in result) return;
    await get().loadPhotos();
  },

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

  setError: (error) => set({ error }),
}));
