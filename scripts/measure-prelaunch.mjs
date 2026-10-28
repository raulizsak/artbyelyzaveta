// Run against `node scripts/local-prelaunch.mjs start` after a production build.
// All records are disposable, and the shared helper refuses cloud databases.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localSupabaseConfig } from "./local-supabase.cjs";

const config = localSupabaseConfig();
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ids = [];
const output = "docs/prelaunch-evidence";
const results = {
  environment: "Local production build; synthetic catalogue",
  runs: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  assert.equal((await fetch("http://127.0.0.1:3000/api/health")).status, 200);
  for (const count of [5, 20, 100]) {
    const additions = Array.from({ length: count - ids.length }, (_, index) => {
      const id = randomUUID();
      return {
        id,
        slug: `local-prelaunch-perf-${id}`,
        title: `Isolated QA artwork ${String(ids.length + index + 1).padStart(3, "0")}`,
        description:
          "Synthetic local verification record; never a real listing.",
        price_cents: 50000 + index * 100,
        shipping_cents: 2500,
        currency: "AUD",
        width_cm: 90,
        height_cm: 60,
        medium: "Oil",
        surface: "Canvas",
        orientation: "landscape",
        status: "available",
        published_at: new Date().toISOString(),
      };
    });
    ids.push(...additions.map((painting) => painting.id));
    assert.equal((await admin.from("paintings").insert(additions)).error, null);
    assert.equal(
      (
        await admin.from("painting_media").insert(
          additions.flatMap((painting) =>
            [
              ["thumbnail", 300],
              ["card", 850],
              ["main", 1080],
            ].map(([variant, width]) => ({
              painting_id: painting.id,
              kind: "artwork",
              variant,
              storage_path: `/optimized/artwork/cows-at-dusk-gallery-wall-${variant}.webp?qa=${painting.id}`,
              width,
              height: width,
              bytes: statSync(
                `public/optimized/artwork/cows-at-dusk-gallery-wall-${variant}.webp`,
              ).size,
              mime_type: "image/webp",
              alt_text:
                "Existing Cows at Dusk photograph reused in isolated local QA",
              position: 0,
            })),
          ),
        )
      ).error,
      null,
    );
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto("http://127.0.0.1:3000/shop");
    await page
      .locator(".catalogue-results")
      .getByText(`${count} originals`, { exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".catalogue-grid > article").count(),
      Math.min(count, 24),
    );
    if (count === 100) {
      await page.getByRole("button", { name: "Show more artworks" }).click();
      await page.locator(".catalogue-grid > article").nth(47).waitFor();
      assert.equal(await page.locator(".catalogue-grid > article").count(), 48);
      assert.match(page.url(), /page=2/);
      await page.reload();
      await page.locator(".catalogue-grid > article").nth(47).waitFor();
    }
    results.runs.push({
      count,
      initialCards: Math.min(count, 24),
      progressiveReload:
        count === 100 ? "48 cards preserved in URL" : "not needed",
    });
    if (count === 20)
      await page.screenshot({
        path: `${output}/shop-20-artworks-desktop.png`,
        fullPage: true,
      });
    await page.close();
  }
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 3 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (mobile) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 90000,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.addInitScript(() => {
      window.__prelaunchMetrics = { lcp: null, cls: 0, inputDurations: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__prelaunchMetrics.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput)
            window.__prelaunchMetrics.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__prelaunchMetrics.inputDurations.push(entry.duration);
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    await page.goto("http://127.0.0.1:3000/shop", { waitUntil: "networkidle" });
    await page.locator(".catalogue-grid > article").nth(23).waitFor();
    await page
      .getByRole("searchbox", { name: "Search artworks", exact: true })
      .fill("Isolated QA artwork 001");
    await page
      .getByRole("button", { name: "Search collection", exact: true })
      .click();
    await page
      .locator(".catalogue-results")
      .getByText("1 original matching", { exact: false })
      .waitFor();
    const metrics = await page.evaluate(() => ({
      ...window.__prelaunchMetrics,
      navigation: performance.getEntriesByType("navigation")[0].toJSON(),
      resourceBytes: performance
        .getEntriesByType("resource")
        .reduce((sum, resource) => sum + resource.transferSize, 0),
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.equal(metrics.overflow, 0);
    results.runs.push({
      profile: mobile
        ? "390px; 1.6Mbps down; 150ms latency; 4x CPU"
        : "1440px; unthrottled",
      ...metrics,
    });
    await page.goto("http://127.0.0.1:3000/shop", { waitUntil: "networkidle" });
    await page.screenshot({
      path: `${output}/shop-100-artworks-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await context.close();
  }
  await writeFile(
    `${output}/performance.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      results.runs.map(({ navigation, ...run }) => ({
        ...run,
        ttfbMs: navigation?.responseStart,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  if (ids.length) {
    const cleanup = await admin
      .from("paintings")
      .delete()
      .in("id", ids)
      .like("slug", "local-prelaunch-perf-%");
    assert.equal(
      cleanup.error,
      null,
      "Isolated performance fixtures must be removed",
    );
  }
}
