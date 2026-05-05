/**
 * PeakPick API Client
 *
 * Connects the React frontend to the Python ML backend at http://localhost:7878.
 * Provides typed fetch functions with timeout handling, error wrapping, and
 * a configurable base URL. Exported as individual const functions for optimal
 * tree-shaking, plus a singleton `api` object for convenience.
 */

// ─── Type Definitions ───────────────────────────────────────────────────────

/** Generic API response: success data or error shape */
export type ApiResponse<T> = T | { error: string; code: string };

/** Full photo object as returned by the backend API */
export interface PhotoDTO {
  id: number;
  filename: string;
  filepath: string;
  score: number;
  status: "pending" | "kept" | "dismissed";
  locked: boolean;
  group_id: number | null;
  date_taken: string;
  width: number;
  height: number;
  file_size: number;
  created_at: string;
}

/** Single entry in the score distribution */
export interface ScoreDistItem {
  base: number;
  count: number;
  percentage: number;
}

/** ML backend status */
export interface MLStatus {
  model: string;
  backend: string;
  cuda_available: boolean;
  version: string;
  photos_scored: number;
  feedback_samples: number;
  online_learning: boolean;
}

/** Result of a scan-import operation */
export interface ImportScanResult {
  count: number;
  date_range: { min: string; max: string };
  files: string[];
}

/** Result of confirming an import */
export interface ImportConfirmResult {
  imported: number;
  failed: number;
  avg_score: number;
}

/** Response from GET /api/photos */
export interface PhotosResponse {
  photos: PhotoDTO[];
  total: number;
  filtered: number;
}

/** Response from GET /api/scores/distribution */
export interface ScoreDistributionResponse {
  distribution: ScoreDistItem[];
  avg_score: number;
  total: number;
}

/** A group of similar photos */
export interface SimilarGroup {
  group_id: number;
  desc: string;
  member_ids: number[];
  best_id: number;
  best_score: number;
}

/** Response from GET /api/photos/similar */
export interface SimilarGroupsResponse {
  groups: SimilarGroup[];
}

/** Response from PATCH /api/photos/{id}/score */
export interface UpdateScoreResponse {
  id: number;
  old_score: number;
  new_score: number;
  model_updated: boolean;
}

/** Response from POST /api/photos/{id}/lock */
export interface ToggleLockResponse {
  id: number;
  locked: boolean;
}

/** Response from PATCH /api/photos/{id}/status */
export interface UpdateStatusResponse {
  id: number;
  status: "pending" | "kept" | "dismissed";
}

/** Response from POST /api/photos/batch/delete */
export interface BatchDeleteResponse {
  deleted: number;
  skipped_locked: number;
  skipped_dismissed: number;
}

/** Response from POST /api/photos/batch/status */
export interface BatchStatusResponse {
  updated: number;
}

/** Health check response */
export interface HealthCheckResponse {
  status: string;
  [key: string]: unknown;
}

/** Query params for GET /api/photos */
export interface FetchPhotosParams {
  status?: string;
  score_min?: number;
  score_max?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  locked?: boolean;
  sort?: string;
  order?: string;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "http://localhost:7878";
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Build a full URL with optional query-string parameters.
 */
function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Core request helper.
 *
 * - Adds Content-Type: application/json
 * - Enforces timeout via AbortController
 * - Parses JSON responses
 * - Returns { error, code } on any failure (never throws)
 */
async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const url = /^https?:\/\//i.test(path) ? path : buildUrl(baseUrl, path);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Attempt to parse JSON body even for error status codes
    let body: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      const text = await response.text();
      body = { error: text || response.statusText };
    }

    if (!response.ok) {
      const errBody = body as { error?: string; code?: string } | undefined;
      return {
        error: errBody?.error ?? `HTTP ${response.status}`,
        code: errBody?.code ?? `HTTP_${response.status}`,
      };
    }

    return body as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "Request timed out", code: "TIMEOUT" };
    }

    const message =
      err instanceof Error ? err.message : "Unknown network error";
    return { error: message, code: "NETWORK_ERROR" };
  }
}



/**    if (!response.ok) {
      return { error: `HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const text = await response.text();
    return text;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "Request timed out", code: "TIMEOUT" };
    }

    const message =
      err instanceof Error ? err.message : "Unknown network error";
    return { error: message, code: "NETWORK_ERROR" };
  }
}

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Fetch a paginated / filtered list of photos.
 * GET /api/photos
 */
export function fetchPhotos(
  params: FetchPhotosParams = {},
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<PhotosResponse>> {
  const url = buildUrl(baseUrl, "/api/photos", params as Record<string, unknown>);
  return request<PhotosResponse>(baseUrl, url, {
    method: "GET",
  });
}

/**
 * Fetch a single photo by ID.
 * GET /api/photos/{id}
 */
export function fetchPhoto(
  id: number,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<PhotoDTO>> {
  return request<PhotoDTO>(baseUrl, `/api/photos/${id}`, {
    method: "GET",
  });
}

/**
 * Scan a directory for importable files (no DB write).
 * POST /api/photos/import/scan
 */
export function scanImport(
  path: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<ImportScanResult>> {
  return request<ImportScanResult>(baseUrl, "/api/photos/import/scan", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

/**
 * Confirm import of scanned files into DB + trigger AI scoring.
 * POST /api/photos/import/confirm
 */
export function confirmImport(
  path: string,
  files: string[],
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<ImportConfirmResult>> {
  return request<ImportConfirmResult>(
    baseUrl,
    "/api/photos/import/confirm",
    {
      method: "POST",
      body: JSON.stringify({ path, files }),
    },
  );
}

/**
 * Update a photo's score. May trigger online learning.
 * PATCH /api/photos/{id}/score
 */
export function updateScore(
  id: number,
  score: number,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<UpdateScoreResponse>> {
  return request<UpdateScoreResponse>(baseUrl, `/api/photos/${id}/score`, {
    method: "PATCH",
    body: JSON.stringify({ score }),
  });
}

/**
 * Toggle the locked state of a photo.
 * POST /api/photos/{id}/lock
 */
export function toggleLock(
  id: number,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<ToggleLockResponse>> {
  return request<ToggleLockResponse>(baseUrl, `/api/photos/${id}/lock`, {
    method: "POST",
  });
}

/**
 * Update a photo's status (pending / kept / dismissed).
 * PATCH /api/photos/{id}/status
 */
export function updateStatus(
  id: number,
  status: "pending" | "kept" | "dismissed",
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<UpdateStatusResponse>> {
  return request<UpdateStatusResponse>(baseUrl, `/api/photos/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/**
 * Batch-delete photos with scores below the given threshold.
 * Locked photos are skipped.
 * POST /api/photos/batch/delete
 */
export function batchDelete(
  threshold: number,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<BatchDeleteResponse>> {
  return request<BatchDeleteResponse>(baseUrl, "/api/photos/batch/delete", {
    method: "POST",
    body: JSON.stringify({ score_threshold: threshold }),
  });
}

/**
 * Batch-update status for a list of photo IDs.
 * POST /api/photos/batch/status
 */
export function batchUpdateStatus(
  ids: number[],
  status: "pending" | "kept" | "dismissed",
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<BatchStatusResponse>> {
  return request<BatchStatusResponse>(baseUrl, "/api/photos/batch/status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
}

/**
 * Fetch score distribution statistics.
 * GET /api/scores/distribution
 */
export function fetchScoreDistribution(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<ScoreDistributionResponse>> {
  return request<ScoreDistributionResponse>(
    baseUrl,
    "/api/scores/distribution",
    { method: "GET" },
  );
}

/**
 * Fetch similar photo groups.
 * GET /api/photos/similar
 */
export function fetchSimilarGroups(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<SimilarGroupsResponse>> {
  return request<SimilarGroupsResponse>(baseUrl, "/api/photos/similar", {
    method: "GET",
  });
}

/**
 * Fetch ML backend status.
 * GET /api/ml/status
 */
export function fetchMLStatus(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<MLStatus>> {
  return request<MLStatus>(baseUrl, "/api/ml/status", {
    method: "GET",
  });
}

/**
 * Fetch a photo thumbnail as a base64-encoded string.
 * GET /api/thumbnails/{id}
 */
export function fetchThumbnail(
  id: number,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<{ id: number; thumbnail: string }>> {
  return request<{ id: number; thumbnail: string }>(baseUrl, `/api/thumbnails/${id}`, {
    method: "GET",
  });
}

/**
 * Health check endpoint.
 * GET /health
 */
export function healthCheck(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResponse<HealthCheckResponse>> {
  return request<HealthCheckResponse>(baseUrl, "/health", {
    method: "GET",
  });
}

// ─── Singleton API Object ───────────────────────────────────────────────────

/**
 * Grouped API client — a singleton object that exposes all API methods.
 * Useful when you want to inject a single dependency or keep a consistent
 * base URL across an entire module.
 */
export const api = {
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
  /** The default base URL used by this client */
  baseUrl: DEFAULT_BASE_URL,
} as const;
