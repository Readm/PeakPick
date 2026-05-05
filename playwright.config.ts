import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        'cd ml-backend && python -c "\nfrom pathlib import Path\nfrom PIL import Image\nimg_dir = Path(\'../e2e/test-data\')\nimg_dir.mkdir(parents=True, exist_ok=True)\ncolors = [(100,150,200),(140,120,180),(180,100,150),(220,200,80),(60,180,220)]\nfor i in range(5):\n    Image.new(\'RGB\', (200,150), colors[i]).save(str(img_dir / f\'photo_{i:03d}.jpg\'), format=\'JPEG\')\nprint(\'Seeded 5 test images\')\n" && uvicorn peakpick_ml.server:app --host 127.0.0.1 --port 7878',
      port: 7878,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npx vite --port 5173",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
