/**
 * Integration tests for the PeakPick Zustand store.
 *
 * Unlike the unit tests in api.test.ts (which test individual API functions),
 * these tests test the STORE through REAL HTTP calls against a fake in-memory
 * backend that implements the same API contract. This proves the
 * store → API → backend contract works end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePhotoStore } from "./store";

// ─── Fake Backend ──────────────────────────────────────────────
//
// Maintains in-memory state and responds to fetch() calls.
// Implements a realistic subset of the PeakPick API.

interface FakePhoto {
  id: number;
  filename: string;
  filepath: string;
  score: number;
  status: string;
  locked: number;
  date_taken: string | null;
  width: number;
  height: number;
  file_size: number;
  created_at: string;
  updated_at: string;
}

let fakePhotos: FakePhoto[];
let feedbackCount: number;

function resetFakeBackend(count: number = 5) {
  const now = new Date().toISOString();
  fakePhotos = [];
  for (let i = 1; i <= count; i++) {
    fakePhotos.push({
      id: i,
      filename: `photo_${String(i).padStart(3, "0")}.jpg`,
      filepath: `/test/photos/photo_${String(i).padStart(3, "0")}.jpg`,
      score: 3.0,
      status: "pending",
      locked: 0,
      date_taken: `2026-0${i % 9 + 1}-${String(10 + i).padStart(2, "0")}`,
      width: 6000,
      height: 4000,
      file_size: 24_000_000,
      created_at: now,
      updated_at: now,
    });
  }
  feedbackCount = 1; // 1 for the initial ml_model_state row
}

function parseUrl(urlStr: string): { path: string; params: URLSearchParams } {
  const url = new URL(urlStr);
  return { path: url.pathname, params: url.searchParams };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { path, params } = parseUrl(urlStr);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(init.body as string) : {};

  // ── GET /health ────────────────────────────────────────────
  if (path === "/health") {
    return Promise.resolve(
      jsonResponse({ status: "ok", device: "cpu", cuda_available: false })
    );
  }

  // ── GET /api/photos ────────────────────────────────────────
  if (path === "/api/photos") {
    let filtered = [...fakePhotos];
    const status = params.get("status");
    if (status && status !== "all") {
      filtered = filtered.filter((p) => p.status === status);
    }
    const scoreMin = params.get("score_min");
    if (scoreMin) {
      filtered = filtered.filter((p) => p.score >= Number(scoreMin));
    }
    const scoreMax = params.get("score_max");
    if (scoreMax) {
      filtered = filtered.filter((p) => p.score <= Number(scoreMax));
    }
    const search = params.get("search");
    if (search) {
      filtered = filtered.filter((p) =>
        p.filename.toLowerCase().includes(search.toLowerCase())
      );
    }
    const locked = params.get("locked");
    if (locked === "true") {
      filtered = filtered.filter((p) => p.locked === 1);
    }
    const sort = params.get("sort") || "date";
    const order = params.get("order") || "asc";
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sort === "score") cmp = a.score - b.score;
      else if (sort === "filename") cmp = a.filename.localeCompare(b.filename);
      else cmp = (a.date_taken ?? "").localeCompare(b.date_taken ?? "");
      return order === "desc" ? -cmp : cmp;
    });
    return Promise.resolve(
      jsonResponse({
        photos: filtered.map((p) => ({
          id: p.id,
          filename: p.filename,
          filepath: p.filepath,
          score: p.score,
          status: p.status,
          locked: p.locked === 1,
          group_id: null,
          date_taken: p.date_taken,
          width: p.width,
          height: p.height,
          file_size: p.file_size,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
        total: fakePhotos.length,
        filtered: filtered.length,
      })
    );
  }

  // ── GET /api/photos/{id} ───────────────────────────────────
  const photoMatch = path.match(/^\/api\/photos\/(\d+)$/);
  if (photoMatch && method === "GET") {
    const id = Number(photoMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ error: "Photo not found", code: "PHOTO_NOT_FOUND" }, 404));
    }
    return Promise.resolve(
      jsonResponse({
        id: photo.id,
        filename: photo.filename,
        filepath: photo.filepath,
        score: photo.score,
        status: photo.status,
        locked: photo.locked === 1,
        group_id: null,
        date_taken: photo.date_taken,
        width: photo.width,
        height: photo.height,
        file_size: photo.file_size,
        created_at: photo.created_at,
        updated_at: photo.updated_at,
      })
    );
  }

  // ── PATCH /api/photos/{id}/score ──────────────────────────
  const scoreMatch = path.match(/^\/api\/photos\/(\d+)\/score$/);
  if (scoreMatch && method === "PATCH") {
    const id = Number(scoreMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ error: "Photo not found", code: "PHOTO_NOT_FOUND" }, 404));
    }
    const oldScore = photo.score;
    const newScore = body.score;
    if (newScore < 1.0 || newScore > 5.0) {
      return Promise.resolve(jsonResponse({ error: "Score out of range" }, 422));
    }
    photo.score = newScore;
    // Simulate feedback increment (on id 1 in ml_model_state)
    feedbackCount++;
    return Promise.resolve(
      jsonResponse({
        id,
        old_score: oldScore,
        new_score: newScore,
        model_updated: true,
      })
    );
  }

  // ── POST /api/photos/{id}/lock ────────────────────────────
  const lockMatch = path.match(/^\/api\/photos\/(\d+)\/lock$/);
  if (lockMatch && method === "POST") {
    const id = Number(lockMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ error: "Photo not found", code: "PHOTO_NOT_FOUND" }, 404));
    }
    photo.locked = photo.locked === 1 ? 0 : 1;
    return Promise.resolve(
      jsonResponse({ id, locked: photo.locked === 1 })
    );
  }

  // ── PATCH /api/photos/{id}/status ─────────────────────────
  const statusMatch = path.match(/^\/api\/photos\/(\d+)\/status$/);
  if (statusMatch && method === "PATCH") {
    const id = Number(statusMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ error: "Photo not found", code: "PHOTO_NOT_FOUND" }, 404));
    }
    const newStatus = body.status;
    if (!["pending", "kept", "dismissed"].includes(newStatus)) {
      return Promise.resolve(jsonResponse({ error: "Invalid status" }, 422));
    }
    photo.status = newStatus;
    return Promise.resolve(jsonResponse({ id, status: newStatus }));
  }

  // ── POST /api/photos/batch/status ─────────────────────────
  if (path === "/api/photos/batch/status" && method === "POST") {
    const ids = body.ids as number[];
    const newStatus = body.status as string;
    let updated = 0;
    for (const p of fakePhotos) {
      if (ids.includes(p.id)) {
        p.status = newStatus;
        updated++;
      }
    }
    return Promise.resolve(jsonResponse({ updated }));
  }

  // ── POST /api/photos/batch/delete ─────────────────────────
  if (path === "/api/photos/batch/delete" && method === "POST") {
    const threshold = body.score_threshold as number;
    const toDelete: number[] = [];
    let skippedLocked = 0;
    let skippedDismissed = 0;
    for (const p of fakePhotos) {
      if (p.score < threshold) {
        if (p.locked === 1) {
          skippedLocked++;
        } else if (p.status === "dismissed") {
          skippedDismissed++;
        } else {
          toDelete.push(p.id);
        }
      }
    }
    fakePhotos = fakePhotos.filter((p) => !toDelete.includes(p.id));
    return Promise.resolve(
      jsonResponse({
        deleted: toDelete.length,
        skipped_locked: skippedLocked,
        skipped_dismissed: skippedDismissed,
      })
    );
  }

  // ── GET /api/photos/similar ───────────────────────────────
  if (path === "/api/photos/similar" && method === "GET") {
    return Promise.resolve(jsonResponse({ groups: [] }));
  }

  // ── GET /api/photos/{id}/group ────────────────────────────
  const groupMatch = path.match(/^\/api\/photos\/(\d+)\/group$/);
  if (groupMatch && method === "GET") {
    const id = Number(groupMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ group: null }));
    }
    return Promise.resolve(jsonResponse({ group: null }));
  }

  // ── GET /api/scores/distribution ──────────────────────────
  if (path === "/api/scores/distribution") {
    const distribution = [1, 2, 3, 4, 5].map((base) => {
      const count = fakePhotos.filter((p) => Math.round(p.score) === base).length;
      return {
        base,
        count,
        percentage: fakePhotos.length > 0 ? Number(((count / fakePhotos.length) * 100).toFixed(1)) : 0,
      };
    });
    const avgScore = fakePhotos.length > 0
      ? Number((fakePhotos.reduce((s, p) => s + p.score, 0) / fakePhotos.length).toFixed(1))
      : 0;
    return Promise.resolve(
      jsonResponse({ distribution, avg_score: avgScore, total: fakePhotos.length })
    );
  }

  // ── GET /api/ml/status ────────────────────────────────────
  if (path === "/api/ml/status") {
    return Promise.resolve(
      jsonResponse({
        model: "heuristic-v1",
        backend: "cpu",
        cuda_available: false,
        version: "0.1.0",
        photos_scored: fakePhotos.length,
        feedback_samples: feedbackCount,
        online_learning: true,
      })
    );
  }

  // ── GET /api/thumbnails/{id} ──────────────────────────────
  const thumbMatch = path.match(/^\/api\/thumbnails\/(\d+)$/);
  if (thumbMatch && method === "GET") {
    const id = Number(thumbMatch[1]);
    const photo = fakePhotos.find((p) => p.id === id);
    if (!photo) {
      return Promise.resolve(jsonResponse({ error: "Photo not found", code: "PHOTO_NOT_FOUND" }, 404));
    }
    return Promise.resolve(jsonResponse({ id, thumbnail: "/9j/4AAQSkZJRg==" }));
  }

  // ── Catch-all ─────────────────────────────────────────────
  return Promise.resolve(jsonResponse({ error: "Not found", code: "NOT_FOUND" }, 404));
}

// ─── Setup / Teardown ──────────────────────────────────────────

beforeEach(() => {
  resetFakeBackend(5);
  vi.stubGlobal("fetch", fakeFetch);
  // Reset the store before each test
  usePhotoStore.setState({
    photos: [],
    loading: false,
    error: null,
    backendConnected: false,
    detailIndex: null,
    detailOpen: false,
    importOpen: false,
    top5Open: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────

describe("Store ↔ API integration", () => {
  it("initBackend connects successfully", async () => {
    const store = usePhotoStore.getState();
    const result = await store.initBackend();
    expect(result).toBe(true);
    expect(usePhotoStore.getState().backendConnected).toBe(true);
  });

  it("initBackend sets disconnected on network error", async () => {
    vi.stubGlobal(
      "fetch",
      () => Promise.reject(new Error("Connection refused"))
    );
    const result = await usePhotoStore.getState().initBackend();
    expect(result).toBe(false);
    expect(usePhotoStore.getState().backendConnected).toBe(false);
  });

  it("loadPhotos fetches and maps photos correctly", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();
    const state = usePhotoStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.photos.length).toBe(5);
    expect(state.photos[0].id).toBe(1);
    expect(state.photos[0].score).toBe(3.0);
    expect(state.photos[0].status).toBe("pending");
    expect(state.photos[0].locked).toBe(false);
  });

  it("loadPhotos sets error on failure", async () => {
    vi.stubGlobal(
      "fetch",
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Server error", code: "ERR" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        )
    );
    await usePhotoStore.getState().loadPhotos();
    const state = usePhotoStore.getState();
    expect(state.error).toBe("Server error");
    expect(state.photos).toEqual([]);
  });

  it("updateScore applies optimistic update and reflects API", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    // Optimistic update
    await store.updateScore(1, 4.5);
    let state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.score).toBe(4.5);

    // Reload and verify persistence
    await store.loadPhotos();
    state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.score).toBe(4.5);
  });

  it("toggleLock optimistically updates and persists", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    // Optimistic toggle
    await store.toggleLock(1);
    let state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.locked).toBe(true);

    // Toggle back
    await store.toggleLock(1);
    state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.locked).toBe(false);
  });

  it("setStatus updates status via API", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    await store.setStatus(1, "kept");
    let state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.status).toBe("kept");

    await store.setStatus(1, "dismissed");
    state = usePhotoStore.getState();
    expect(state.photos.find((p) => p.id === 1)?.status).toBe("dismissed");
  });

  it("toggleSelect / selectAll / clearSelection work locally", () => {
    const store = usePhotoStore.getState();
    // Seed some photos with known state
    usePhotoStore.setState({
      photos: [
        { id: 1, selected: false } as any,
        { id: 2, selected: false } as any,
        { id: 3, selected: false } as any,
      ],
    });

    store.toggleSelect(2);
    expect(usePhotoStore.getState().photos.find((p) => p.id === 2)?.selected).toBe(true);

    store.selectAll();
    expect(usePhotoStore.getState().photos.every((p) => p.selected)).toBe(true);

    store.clearSelection();
    expect(usePhotoStore.getState().photos.every((p) => !p.selected)).toBe(true);
  });

  it("batchDismiss calls API and reloads", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    // Select first two photos
    store.toggleSelect(1);
    store.toggleSelect(2);

    await store.batchDismiss();
    // After reload, photos should still exist but with updated status
    const state = usePhotoStore.getState();
    expect(state.photos.length).toBe(5);
  });

  it("batchKeep calls API and reloads", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    store.selectAll();
    await store.batchKeep();

    const state = usePhotoStore.getState();
    expect(state.photos.length).toBe(5);
  });

  it("selectTop9 selects highest scored photos", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();
    store.clearSelection();

    // Set varying scores
    await store.updateScore(1, 5.0);
    await store.updateScore(2, 4.0);
    await store.updateScore(3, 3.0);
    await store.updateScore(4, 2.0);
    await store.updateScore(5, 1.0);

    store.selectTop9();
    const state = usePhotoStore.getState();
    const selected = state.photos.filter((p) => p.selected);
    expect(selected.length).toBe(5); // Only 5 photos exist, all should be selected
  });

  it("batchDeleteLow calls API and reloads", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    await store.batchDeleteLow();
    const state = usePhotoStore.getState();
    expect(state.loading).toBe(false);
  });

  it("openDetail / closeDetail / navigateDetail work correctly", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    store.openDetail(3);
    let state = usePhotoStore.getState();
    expect(state.detailOpen).toBe(true);
    expect(state.detailIndex).toBe(2); // 0-indexed

    store.navigateDetail(1);
    state = usePhotoStore.getState();
    expect(state.detailIndex).toBe(3); // moved to photo 4

    store.navigateDetail(-2);
    state = usePhotoStore.getState();
    expect(state.detailIndex).toBe(1); // moved to photo 2

    store.closeDetail();
    state = usePhotoStore.getState();
    expect(state.detailOpen).toBe(false);
    expect(state.detailIndex).toBeNull();
  });

  it("navigateDetail does not go out of bounds", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();
    await store.loadPhotos();

    store.openDetail(1); // first photo
    store.navigateDetail(-1); // try to go before first
    const state1 = usePhotoStore.getState();
    expect(state1.detailIndex).toBe(0); // clamped

    store.openDetail(5); // last photo
    store.navigateDetail(1); // try to go past last
    const state2 = usePhotoStore.getState();
    expect(state2.detailIndex).toBe(4); // clamped
  });

  it("setFilter updates filter state", () => {
    const store = usePhotoStore.getState();
    store.setFilter({ mode: "kept", scoreThreshold: 3 });
    const state = usePhotoStore.getState();
    expect(state.filter.mode).toBe("kept");
    expect(state.filter.scoreThreshold).toBe(3);
  });

  it("setDateRange updates date range", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-12-31");
    usePhotoStore.getState().setDateRange({ start, end });
    const state = usePhotoStore.getState();
    expect(state.dateRange.start).toEqual(start);
    expect(state.dateRange.end).toEqual(end);
  });

  it("importOpen toggles correctly", () => {
    usePhotoStore.getState().setImportOpen(true);
    expect(usePhotoStore.getState().importOpen).toBe(true);

    usePhotoStore.getState().setImportOpen(false);
    expect(usePhotoStore.getState().importOpen).toBe(false);
  });

  it("setError sets and clears error", () => {
    usePhotoStore.getState().setError("Something went wrong");
    expect(usePhotoStore.getState().error).toBe("Something went wrong");

    usePhotoStore.getState().setError(null);
    expect(usePhotoStore.getState().error).toBeNull();
  });

  it("loadPhotos respects filter params", async () => {
    const store = usePhotoStore.getState();
    await store.initBackend();

    // Set filter to kept (none are kept initially)
    store.setFilter({ mode: "kept" });
    await store.loadPhotos();
    let state = usePhotoStore.getState();
    // The fake backend filters by status, so 0 photos should match
    expect(state.photos.length).toBe(0);

    // Change filter back to pending
    store.setFilter({ mode: "pending" });
    await store.loadPhotos();
    state = usePhotoStore.getState();
    expect(state.photos.length).toBe(5);
  });
});
