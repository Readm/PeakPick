#!/usr/bin/env node
/**
 * PeakPick Screenshot Capture
 *
 * Starts the Vite dev server (if not running), captures screenshots
 * of the React frontend at various states, and saves them.
 *
 * Usage:
 *   node scripts/screenshot.mjs                    # Capture all screens
 *   node scripts/screenshot.mjs --cycle setup      # Custom cycle name
 *   node scripts/screenshot.mjs --url http://localhost:1420  # Custom URL
 */

import { chromium } from "@playwright/test";
import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Parse args
const args = process.argv.slice(2);
const cycleName = args.includes("--cycle")
  ? args[args.indexOf("--cycle") + 1]
  : `cycle-${new Date().toISOString().slice(0, 10)}`;
const targetUrl =
  (args.includes("--url") && args[args.indexOf("--url") + 1]) ||
  "http://localhost:1420";

const SCREENSHOT_DIR = resolve(REPO_ROOT, "screenshots", cycleName);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
];

async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} not ready after ${maxRetries}s`);
}

async function capture() {
  console.log(`📸 PeakPick Screenshot Capture — Cycle: ${cycleName}`);
  console.log(`   Target: ${targetUrl}`);
  console.log(`   Output: ${SCREENSHOT_DIR}\n`);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Check if server is running; if not, start it
  let serverProcess = null;
  try {
    await waitForServer(targetUrl, 3);
    console.log("✅ Server already running");
  } catch {
    console.log("🚀 Starting Vite dev server...");
    serverProcess = spawn("npm", ["run", "dev", "--", "--port", "1420"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BROWSER: "none" },
    });

    // Wait for it to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server start timeout")), 30000);
      serverProcess.stdout.on("data", (data) => {
        const text = data.toString();
        console.log("  ", text.trim());
        if (text.includes("localhost:1420") || text.includes("ready in")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      serverProcess.stderr.on("data", (data) => {
        const text = data.toString();
        if (text.includes("Error") || text.includes("error")) {
          console.error("  !", text.trim());
        }
      });
    });
    console.log("✅ Server started");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: 2, // Retina quality
  });

  const captured = [];

  try {
    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Screenshot 1: Full page (app initialization state)
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(500);

      const defaultPath = resolve(SCREENSHOT_DIR, `app-default-${vp.name}.png`);
      await page.screenshot({ path: defaultPath, fullPage: true });
      captured.push(defaultPath);
      console.log(`  ✅ ${vp.name} default — ${defaultPath}`);

      // Screenshot 2: Empty state (if we can trigger it)
      // For now, capture the initial render state

      await page.close();
    }

    // Generate index
    const indexPath = resolve(SCREENSHOT_DIR, "index.json");
    writeFileSync(indexPath, JSON.stringify({ cycle: cycleName, url: targetUrl, screenshots: captured }, null, 2));

    console.log(`\n📁 ${captured.length} screenshots → ${SCREENSHOT_DIR}`);
    console.log("📋 Done!");
  } finally {
    await browser.close();
    // Don't kill the server — it might be used by other processes
  }
}

capture().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
