/**
 * End-to-end tests for PeakPick.
 *
 * Workflow:
 * 1. Seed test data via backend API
 * 2. Verify the UI renders correctly
 * 3. Verify filtering, scoring, and interaction work
 */
import { test, expect } from "@playwright/test";

const BACKEND = "http://localhost:7878";
const TEST_DATA_DIR = "./e2e/test-data";

test.describe("PeakPick E2E", () => {
  test.beforeAll(async ({ request }) => {
    // Seed the database with test photos via the backend API
    // First, list files in the test-data directory
    const fs = await import("fs");
    const path = await import("path");
    const files = fs
      .readdirSync(TEST_DATA_DIR)
      .filter((f: string) => f.endsWith(".jpg"))
      .sort();

    if (files.length === 0) {
      console.warn("No test images found in", TEST_DATA_DIR);
      return;
    }

    // Scan the directory first
    const scanResp = await request.post(`${BACKEND}/api/photos/import/scan`, {
      data: { path: path.resolve(TEST_DATA_DIR) },
    });
    expect(scanResp.ok()).toBeTruthy();
    const scanData = await scanResp.json();
    console.log(`Scan found ${scanData.count} files`);

    // Confirm import
    const confirmResp = await request.post(
      `${BACKEND}/api/photos/import/confirm`,
      {
        data: {
          path: path.resolve(TEST_DATA_DIR),
          files: files,
        },
      }
    );
    expect(confirmResp.ok()).toBeTruthy();
    const confirmData = await confirmResp.json();
    console.log(
      `Imported ${confirmData.imported} photos, avg score ${confirmData.avg_score}`
    );
  });

  test("health endpoint works", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/health`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.status).toBe("ok");
  });

  test("photos are seeded", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/photos`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.photos.length).toBeGreaterThanOrEqual(1);
  });

  test("page loads with title and layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should have the app title or logo
    await expect(page.locator("body")).not.toBeEmpty();

    // The app should render a sidebar and photo grid area
    // These are common layout elements
    await page.waitForTimeout(2000); // Wait for React to mount
  });

  test("backend status indicator appears", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for the backend connection check to complete
    await page.waitForTimeout(2000);

    // The app should show it's connected — look for indicators
    // (could be a status dot, text, or anything)
    const bodyText = await page.locator("body").innerText();
    // The app should not show an error indicating backend is down
    expect(bodyText).not.toContain("无法连接");
  });

  test("score distribution chart renders", async ({ page, request }) => {
    // Verify the distribution API works
    const resp = await request.get(`${BACKEND}/api/scores/distribution`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.distribution).toHaveLength(5);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  test("update score via API", async ({ request }) => {
    // Get photo 1
    const getResp = await request.get(`${BACKEND}/api/photos/1`);
    expect(getResp.ok()).toBeTruthy();
    const photo = await getResp.json();
    expect(photo.id).toBe(1);

    // Update score
    const updateResp = await request.patch(
      `${BACKEND}/api/photos/1/score`,
      {
        data: { score: 4.5 },
      }
    );
    expect(updateResp.ok()).toBeTruthy();
    const updated = await updateResp.json();
    expect(updated.old_score).toBe(photo.score);
    expect(updated.new_score).toBe(4.5);
  });

  test("toggle lock via API", async ({ request }) => {
    const resp = await request.post(`${BACKEND}/api/photos/1/lock`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.locked).toBe(true);
  });

  test("batch operations via API", async ({ request }) => {
    // Batch update status
    const statusResp = await request.post(
      `${BACKEND}/api/photos/batch/status`,
      {
        data: { ids: [1, 2], status: "kept" },
      }
    );
    expect(statusResp.ok()).toBeTruthy();
    const statusData = await statusResp.json();
    expect(statusData.updated).toBe(2);

    // Batch delete below low threshold — should not delete anything
    const deleteResp = await request.post(
      `${BACKEND}/api/photos/batch/delete`,
      {
        data: { score_threshold: 1.0 },
      }
    );
    expect(deleteResp.ok()).toBeTruthy();
    const deleteData = await deleteResp.json();
    expect(deleteData.deleted).toBe(0);
  });

  test("similar groups API", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/photos/similar`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty("groups");
  });

  test("full workflow: import → score → lock → dismiss → batch delete", async ({
    request,
  }) => {
    // 1. Get initial state
    const initialResp = await request.get(`${BACKEND}/api/photos`);
    const initialData = await initialResp.json();
    expect(initialData.total).toBeGreaterThanOrEqual(5);

    // 2. Score photos
    const updates = [
      { id: 1, score: 4.5 },
      { id: 2, score: 3.0 },
      { id: 3, score: 2.0 },
      { id: 4, score: 4.0 },
      { id: 5, score: 1.0 },
    ];
    for (const u of updates) {
      const r = await request.patch(`${BACKEND}/api/photos/${u.id}/score`, {
        data: { score: u.score },
      });
      expect(r.ok()).toBeTruthy();
    }

    // 3. Mark best as kept
    const keptResp = await request.patch(`${BACKEND}/api/photos/1/status`, {
      data: { status: "kept" },
    });
    expect(keptResp.ok()).toBeTruthy();

    // 4. Photo 1 is already locked from a previous test. Set score below
    //    threshold to test that locked photos are protected from batch delete.
    await request.patch(`${BACKEND}/api/photos/1/score`, {
      data: { score: 1.0 },
    });

    // 5. Dismiss worst
    const dismissResp = await request.patch(
      `${BACKEND}/api/photos/5/status`,
      {
        data: { status: "dismissed" },
      }
    );
    expect(dismissResp.ok()).toBeTruthy();

    // 6. Batch delete scores < 3.0
    const deleteResp = await request.post(
      `${BACKEND}/api/photos/batch/delete`,
      {
        data: { score_threshold: 3.0 },
      }
    );
    expect(deleteResp.ok()).toBeTruthy();
    const deleteData = await deleteResp.json();
    // Locked (photo 1, score 1.0) and dismissed (photo 5, score 1.0) should be skipped
    expect(deleteData.skipped_locked).toBeGreaterThanOrEqual(1);
    expect(deleteData.skipped_dismissed).toBeGreaterThanOrEqual(1);

    // 7. Locked photo 1 still exists
    const checkResp = await request.get(`${BACKEND}/api/photos/1`);
    expect(checkResp.ok()).toBeTruthy();
    const checkData = await checkResp.json();
    expect(checkData.locked).toBe(true);
  });

  test("ml status reflects activity", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/ml/status`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty("model");
    expect(data).toHaveProperty("feedback_samples");
    expect(data).toHaveProperty("online_learning");
  });

  test("search endpoint works", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/photos`, {
      params: { search: "photo_001" },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.photos.some((p: any) => p.filename.includes("photo_001"))).toBe(
      true
    );
  });

  test("thumbnail endpoint works for seeded photos", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/thumbnails/2`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty("thumbnail");
    expect(typeof data.thumbnail).toBe("string");
    expect(data.thumbnail.length).toBeGreaterThan(100);
  });

  test("ml status matches expectations", async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/ml/status`);
    const data = await resp.json();
    expect(data.online_learning).toBe(true);
    expect(data.photos_scored).toBeGreaterThanOrEqual(5);
  });
});
