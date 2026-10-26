import { expect, test } from "@playwright/test";

test.describe("375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("all 12 colour swatches fit on screen without hidden scrolling", async ({ page }) => {
    await page.goto("/");
    const right = await page.locator(".sw button").last().evaluate((e) => e.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(375);
  });

  test("changing the colour filter deep in the wall returns to the top of the results", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card").nth(63)).toBeAttached();
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(150);
    }
    await page.getByRole("button", { name: "紫", exact: true }).click();
    await page.waitForTimeout(600);
    const first = await page.locator(".card").first().evaluate((e) => e.getBoundingClientRect().top);
    const finderBottom = await page.locator("#finder").evaluate((e) => e.getBoundingClientRect().bottom);
    expect(first).toBeGreaterThanOrEqual(finderBottom - 1);
    expect(first).toBeLessThan(812);
  });
});

test.describe("1280px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("detail faces sit on whole CSS pixels", async ({ page }) => {
    const id = 15;
    await page.goto(`/?cape=${id}`);
    const rects = await page.locator(".face .cape").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [r.left, r.top];
      }),
    );
    for (const [x, y] of rects) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });
});
