import { expect, test } from "@playwright/test";

test("index and atlas URLs carry the data revision, and the index is fetched once", async ({ page }) => {
  const indexHits: string[] = [];
  const atlasHits: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/data/index.json")) indexHits.push(r.url());
    if (r.url().includes("/data/atlas/")) atlasHits.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator(".card").nth(63)).toBeAttached();
  await page.waitForLoadState("networkidle");
  expect(indexHits).toHaveLength(1);
  expect(indexHits[0]).toMatch(/\/data\/index\.json\?r=[0-9a-f]{10}$/);
  const rev = new URL(indexHits[0]).searchParams.get("r");
  expect(atlasHits.length).toBeGreaterThan(0);
  for (const url of atlasHits) expect(new URL(url).searchParams.get("r")).toBe(rev);
});
