/**
 * PeakPick Tauri bridge.
 * Safely wraps Tauri invoke calls with browser fallback detection.
 */

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

// Synchronous Tauri detection (no top-level await needed)
// @ts-expect-error - Tauri injects this at runtime
const hasTauriAPI = typeof window !== "undefined" && window.__TAURI_INTERNALS__;

if (hasTauriAPI) {
  // Dynamic import only when in Tauri — safe because Tauri supports top-level await
  import("@tauri-apps/api/core").then((mod) => {
    tauriInvoke = mod.invoke;
  });
}

export const isTauri = hasTauriAPI;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriInvoke) {
    throw new Error("Not running in Tauri");
  }
  return tauriInvoke(cmd, args) as Promise<T>;
}

/**
 * Open native folder selection dialog.
 */
export async function selectFolder(): Promise<string | null> {
  try {
    return await invoke<string | null>("select_folder");
  } catch {
    return prompt("Enter folder path:") || null;
  }
}

/**
 * Read an image file and return a base64 data URL.
 */
export async function readImage(path: string): Promise<string | null> {
  try {
    return await invoke<string>("read_image_as_base64", { path });
  } catch {
    console.warn("readImage failed:", path);
    return null;
  }
}

/**
 * Start the Python ML backend process.
 */
export async function startBackend(): Promise<boolean> {
  try {
    await invoke<string>("start_backend");
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop the Python ML backend process.
 */
export async function stopBackend(): Promise<void> {
  try {
    await invoke<void>("stop_backend");
  } catch {
    console.warn("stopBackend failed");
  }
}

/**
 * Check if the Python backend process is running.
 */
export async function getBackendStatus(): Promise<boolean> {
  try {
    return await invoke<boolean>("get_backend_status");
  } catch {
    return false;
  }
}

/**
 * Get the platform-appropriate app data directory path.
 */
export async function getAppDataDir(): Promise<string> {
  try {
    return await invoke<string>("get_app_data_dir");
  } catch {
    return "";
  }
}
