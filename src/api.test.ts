/**
 * Tests for the PeakPick API client.
 *
 * Uses vitest with mocked global fetch() to verify request building,
 * timeout handling, error wrapping, and response parsing for every
 * endpoint exposed by the api module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import {
  fetchPhotos,
  fetchPhoto,
  scanImport,
  confirmImport,
  updateScore,
  toggleLock,
  updateStatus,
  batchDelete,
  batchUpdateStatus,
  fetchScoreDistribution,
  fetchSimilarGroups,
  fetchMLStatus,
  fetchThumbnail,
  healthCheck,
  api,
} from "./api";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a mock Response object for successful JSON data */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a mock Response object for JSON error responses */
function errorResponse(
  status: number,
  error: string,
  code = "",
): Response {
  const body: Record<string, string> = { error };
  if (code) body.code = code;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("fetchPhotos", () => {
  it("calls GET /api/photos and returns photos", async () => {
    const responseData = {
      photos: [
        {
          id: 1,
          filename: "DSC_00123.NEF",
          filepath: "/photos/DSC_00123.NEF",
          score: 3.8,
          status: "pending",
          locked: false,
          group_id: null,
          date_taken: "2026-03-15",
          width: 6000,
          height: 4000,
          file_size: 24_300_000,
          created_at: "2026-05-05T10:00:00Z",
        },
      ],
      total: 84,
      filtered: 42,
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await fetchPhotos({ status: "pending", sort: "date" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos");
    expect(options.method).toBe("GET");
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(options.signal).toBeDefined();

    if ("error" in result) {
      throw new Error("Expected success, got error: " + result.error);
    }
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].filename).toBe("DSC_00123.NEF");
    expect(result.total).toBe(84);
  });

  it("returns error object on HTTP failure", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "Internal error", "SRV_ERR"));

    const result = await fetchPhotos();
    expect("error" in result && result.error).toBe("Internal error");
  });

  it("returns error on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("Network is down"));

    const result = await fetchPhotos();
    expect("error" in result && result.error).toBe("Network is down");
  });
});

describe("fetchPhoto", () => {
  it("calls GET /api/photos/{id}", async () => {
    const photo = {
      id: 42,
      filename: "DSC_00042.NEF",
      filepath: "/photos/DSC_00042.NEF",
      score: 4.2,
      status: "kept" as const,
      locked: true,
      group_id: null,
      date_taken: "2026-04-01",
      width: 6000,
      height: 4000,
      file_size: 24_300_000,
      created_at: "2026-05-05T10:00:00Z",
    };
    fetchMock.mockResolvedValue(jsonResponse(photo));

    const result = await fetchPhoto(42);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos/42");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.id).toBe(42);
    expect(result.filename).toBe("DSC_00042.NEF");
  });

  it("returns error on 404", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, "Photo not found", "NOT_FOUND"));

    const result = await fetchPhoto(999);
    expect("error" in result && result.error).toBe("Photo not found");
  });
});

describe("scanImport", () => {
  it("calls POST /api/photos/import/scan with path", async () => {
    const responseData = {
      count: 247,
      date_range: { min: "2026-01-01", max: "2026-05-05" },
      files: ["DSC_00001.NEF", "DSC_00002.NEF"],
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await scanImport("/media/usb/DCIM");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ path: "/media/usb/DCIM" }));

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.count).toBe(247);
    expect(result.files).toHaveLength(2);
  });
});

describe("confirmImport", () => {
  it("calls POST /api/photos/import/confirm with path and files", async () => {
    const responseData = { imported: 247, failed: 0, avg_score: 3.2 };
    fetchMock.mockResolvedValue(jsonResponse(responseData, 201));

    const result = await confirmImport("/media/usb/DCIM", [
      "DSC_00001.NEF",
      "DSC_00002.NEF",
    ]);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      path: "/media/usb/DCIM",
      files: ["DSC_00001.NEF", "DSC_00002.NEF"],
    });

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.imported).toBe(247);
    expect(result.avg_score).toBe(3.2);
  });
});

describe("updateScore", () => {
  it("calls PATCH /api/photos/{id}/score", async () => {
    const responseData = {
      id: 1,
      old_score: 3.8,
      new_score: 4.3,
      model_updated: true,
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await updateScore(1, 4.3);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos/1/score");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ score: 4.3 });

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.model_updated).toBe(true);
  });
});

describe("toggleLock", () => {
  it("calls POST /api/photos/{id}/lock", async () => {
    const responseData = { id: 1, locked: true };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await toggleLock(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos/1/lock");
    expect(options.method).toBe("POST");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.locked).toBe(true);
  });
});

describe("updateStatus", () => {
  it("calls PATCH /api/photos/{id}/status", async () => {
    const responseData = { id: 1, status: "kept" as const };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await updateStatus(1, "kept");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos/1/status");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ status: "kept" });

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.status).toBe("kept");
  });
});

describe("batchDelete", () => {
  it("calls POST /api/photos/batch/delete with score_threshold", async () => {
    const responseData = { deleted: 12, skipped_locked: 2, skipped_dismissed: 1 };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await batchDelete(2.5);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ score_threshold: 2.5 });

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.deleted).toBe(12);
  });
});

describe("batchUpdateStatus", () => {
  it("calls POST /api/photos/batch/status with ids and status", async () => {
    const responseData = { updated: 4 };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await batchUpdateStatus([1, 2, 3, 5], "dismissed");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      ids: [1, 2, 3, 5],
      status: "dismissed",
    });

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.updated).toBe(4);
  });
});

describe("fetchScoreDistribution", () => {
  it("calls GET /api/scores/distribution", async () => {
    const responseData = {
      distribution: [
        { base: 1, count: 5, percentage: 6.0 },
        { base: 2, count: 12, percentage: 14.3 },
        { base: 3, count: 28, percentage: 33.3 },
        { base: 4, count: 22, percentage: 26.2 },
        { base: 5, count: 17, percentage: 20.2 },
      ],
      avg_score: 3.4,
      total: 84,
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await fetchScoreDistribution();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/scores/distribution");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.distribution).toHaveLength(5);
    expect(result.avg_score).toBe(3.4);
    expect(result.total).toBe(84);
  });
});

describe("fetchSimilarGroups", () => {
  it("calls GET /api/photos/similar", async () => {
    const responseData = {
      groups: [
        {
          group_id: 1,
          desc: "几乎相同的构图，曝光不同",
          member_ids: [2, 15, 27, 41],
          best_id: 15,
          best_score: 4.0,
        },
      ],
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await fetchSimilarGroups();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/photos/similar");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].desc).toBe("几乎相同的构图，曝光不同");
  });
});

describe("fetchMLStatus", () => {
  it("calls GET /api/ml/status", async () => {
    const responseData = {
      model: "CLIP-ViT-L",
      backend: "cpu",
      cuda_available: false,
      version: "0.1.0",
      photos_scored: 84,
      feedback_samples: 12,
      online_learning: true,
    };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await fetchMLStatus();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/ml/status");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.model).toBe("CLIP-ViT-L");
    expect(result.online_learning).toBe(true);
  });
});

describe("fetchThumbnail", () => {
  it("calls GET /api/thumbnails/{id} and returns object", async () => {
    const resp = { id: 42, thumbnail: "/9j/4AAQSkZJRg==" };
    fetchMock.mockResolvedValue(jsonResponse(resp));

    const result = await fetchThumbnail(42);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/thumbnails/42");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.id).toBe(42);
    expect(result.thumbnail).toBe("/9j/4AAQSkZJRg==");
  });

  it("returns error on thumbnail fetch failure", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, "Thumbnail not found"));

    const result: unknown = await fetchThumbnail(999);
    expect(result !== null && typeof result === "object" && "error" in result).toBe(true);
  });
});

describe("healthCheck", () => {
  it("calls GET /health", async () => {
    const responseData = { status: "ok", version: "0.1.0" };
    fetchMock.mockResolvedValue(jsonResponse(responseData));

    const result = await healthCheck();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/health");

    if ("error" in result) throw new Error("Unexpected error");
    expect(result.status).toBe("ok");
  });
});

describe("timeout handling", () => {
  it("returns timeout error when AbortController fires", async () => {
    // Simulate abort by having fetch throw an AbortError
    const abortError = new DOMException("The operation was aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);

    const result = await fetchPhotos();
    expect("error" in result && result.error).toBe("Request timed out");
    expect("code" in result && result.code).toBe("TIMEOUT");
  });
});

describe("api singleton", () => {
  it("exposes all methods and has a default baseUrl", () => {
    expect(api.fetchPhotos).toBe(fetchPhotos);
    expect(api.fetchPhoto).toBe(fetchPhoto);
    expect(api.scanImport).toBe(scanImport);
    expect(api.confirmImport).toBe(confirmImport);
    expect(api.updateScore).toBe(updateScore);
    expect(api.toggleLock).toBe(toggleLock);
    expect(api.updateStatus).toBe(updateStatus);
    expect(api.batchDelete).toBe(batchDelete);
    expect(api.batchUpdateStatus).toBe(batchUpdateStatus);
    expect(api.fetchScoreDistribution).toBe(fetchScoreDistribution);
    expect(api.fetchSimilarGroups).toBe(fetchSimilarGroups);
    expect(api.fetchMLStatus).toBe(fetchMLStatus);
    expect(api.fetchThumbnail).toBe(fetchThumbnail);
    expect(api.healthCheck).toBe(healthCheck);
    expect(api.baseUrl).toBe("http://localhost:7878");
  });
});

describe("custom base URL", () => {
  it("allows overriding baseUrl per call", async () => {
    const customUrl = "http://custom:9999";
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await healthCheck(customUrl);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(customUrl);
    expect(url).toContain("/health");
  });
});

describe("AbortController signal propagation", () => {
  it("passes an AbortSignal to fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ photos: [], total: 0, filtered: 0 }));

    await fetchPhotos();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
