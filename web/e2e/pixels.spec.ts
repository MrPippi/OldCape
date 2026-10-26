import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 375, height: 812, scale: 4 },
  { width: 768, height: 1024, scale: 5 },
  { width: 1280, height: 800, scale: 6 },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("capes render at an exact integer scale and nothing scrolls sideways", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".card").nth(63)).toBeAttached();
      // measure at rest: mid-entrance the fractional `translate` adds float noise to rects
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations()
            .filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest(".card"))
            .map((a) => a.finished),
        ),
      );
      // the face shown at rest; the back face is pre-rotated 180deg for the flip
      const sizes = await page.locator(".card .cape:not(.back)").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return [r.width, r.height, getComputedStyle(e).imageRendering];
        }),
      );
      for (const [w, h, rendering] of sizes) {
        expect([w, h]).toEqual([10 * vp.scale, 16 * vp.scale]);
        expect(rendering).toBe("pixelated");
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("card boxes do not move when atlas images arrive late", async ({ page }) => {
      await page.route("**/data/atlas/*.png", async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.continue();
      });
      await page.goto("/");
      await expect(page.locator(".card").nth(63)).toBeAttached();
      const rects = () =>
        page.locator(".card").evaluateAll((els) =>
          els.slice(0, 12).map((e) => JSON.stringify(e.getBoundingClientRect())),
        );
      const before = await rects();
      await page.waitForLoadState("networkidle");
      expect(await rects()).toEqual(before);
    });

    test("wall does not move when the index arrives late", async ({ page }) => {
      await page.route("**/data/index.json", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await page.goto("/");
      const wallTop = () => page.locator("#wall").evaluate((e) => e.getBoundingClientRect().top);
      const before = await wallTop();
      await expect(page.locator(".card").nth(63)).toBeAttached();
      await page.waitForLoadState("networkidle");
      expect(await wallTop()).toBe(before);
    });

    test("finder stays on screen while scrolling the wall", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".card").nth(63)).toBeAttached();
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(500);
      const top = await page.locator("#finder").evaluate((e) => e.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(2);
    });
  });
}
