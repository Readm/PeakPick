import { chromium } from "@playwright/test";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKETCHES = resolve(__dirname, "..", "sketches", "001-ux-first");
const SCREENSHOTS = resolve(__dirname, "..", "screenshots", "001-ux-first");
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
];

const variants = [
  { name: "variant-a-tool", file: "variant-a-tool/index.html" },
  { name: "variant-b-focus", file: "variant-b-focus/index.html" },
];

async function capture() {
  console.log("📸 Capturing sketches for UX-First cycle\n");
  mkdirSync(SCREENSHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const v of variants) {
    const url = `file://${resolve(SKETCHES, v.file)}`;
    console.log(`  Variant: ${v.name}`);

    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(500);

      // Full page screenshot
      const path = resolve(SCREENSHOTS, `${v.name}-${vp.name}.png`);
      await page.screenshot({ path, fullPage: true });
      console.log(`    ✅ ${vp.name} → ${path}`);

      // Also capture the import dialog open
      if (v.name === "variant-a-tool") {
        await page.evaluate(() => document.getElementById("import-overlay")?.classList.add("open"));
      } else {
        await page.evaluate(() => document.getElementById("import-modal")?.classList.add("open"));
      }
      await page.waitForTimeout(300);
      const importPath = resolve(SCREENSHOTS, `${v.name}-${vp.name}-import.png`);
      await page.screenshot({ path: importPath });
      console.log(`    ✅ ${vp.name} import dialog → ${importPath}`);

      // Close dialog
      await page.evaluate(() => {
        const els = document.querySelectorAll(".import-overlay, .modal-overlay");
        els.forEach(el => el.classList.remove("open"));
      });

      // Capture detail view (first photo)
      await page.evaluate(() => {
        const firstCard = document.querySelector(".photo-card");
        if (firstCard) firstCard.click();
      });
      await page.waitForTimeout(300);
      const detailPath = resolve(SCREENSHOTS, `${v.name}-${vp.name}-detail.png`);
      await page.screenshot({ path: detailPath });
      console.log(`    ✅ ${vp.name} detail view → ${detailPath}`);

      // Close detail
      await page.evaluate(() => {
        const els = document.querySelectorAll(".detail-overlay");
        els.forEach(el => el.classList.remove("open"));
      });

      await page.close();
    }
    console.log();
  }

  // Write index
  writeFileSync(resolve(SCREENSHOTS, "index.json"), JSON.stringify({
    cycle: "001-ux-first",
    variants: variants.map(v => v.name),
    viewports: VIEWPORTS.map(v => v.name),
  }, null, 2));

  await browser.close();
  console.log("📁 All screenshots saved to:", SCREENSHOTS);
}

capture().catch(err => { console.error("❌", err); process.exit(1); });
