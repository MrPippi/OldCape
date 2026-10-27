import { expect, test } from "@playwright/test";
import { pngSize } from "./helpers";

const SITE = "https://oldcape.org";

test("link previews: title, description and a 1200x630 image", async ({ page, request }) => {
  await page.goto("/");
  const meta = (sel: string) => page.locator(sel).getAttribute("content");
  expect(await meta('meta[property="og:title"]')).toBe("老披風 OldCape｜台灣麥塊玩家披風典藏");
  expect(await meta('meta[property="og:description"]')).toContain("三萬件");
  expect(await meta('meta[property="og:url"]')).toBe(`${SITE}/`);
  expect(await meta('meta[property="og:type"]')).toBe("website");
  expect(await meta('meta[property="og:locale"]')).toBe("zh_TW");
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  const image = await meta('meta[property="og:image"]');
  expect(image).toBe(`${SITE}/og.png`);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`${SITE}/`);
  const png = await request.get("/og.png");
  expect(png.ok()).toBe(true);
  expect(pngSize(Buffer.from(await png.body()))).toEqual([1200, 630]);
});

test("says plainly that this is an unofficial fan site", async ({ page }) => {
  // one real load (a second goto that only changes the hash would not reload the page)
  await page.goto("/#about");
  const about = page.getByRole("dialog", { name: "關於老披風" });
  await expect(about).toContainText("NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.");
  await about.getByRole("button", { name: "關閉" }).click();
  await expect(page.locator(".hero .unofficial")).toHaveText("非官方網站 · 與 Mojang、Microsoft 無關");
});

test("robots.txt points at the sitemap and keeps the API and admin out", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  expect(robots).toMatch(/Disallow: \/api\//);
  expect(robots).toMatch(/Disallow: \/admin/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>${SITE}/</loc>`);
});
