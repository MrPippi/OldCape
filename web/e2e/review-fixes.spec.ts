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

  test("a face squared to the viewer sits on whole CSS pixels at exact 12x", async ({ page }) => {
    await page.goto("/?cape=15");
    await page.getByRole("button", { name: "內側" }).click();
    const face = page.locator(".slab .back");
    await expect
      .poll(() => face.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }))
      .toEqual([expect.any(Number), expect.any(Number), 120, 192]);
    const [x, y] = await face.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top]; });
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });

  test("the detail cape spins on its own and can be dragged", async ({ page }) => {
    await page.goto("/?cape=15");
    const box = page.locator(".slab");
    expect(await box.evaluate((e) => getComputedStyle(e).animationName)).toBe("slab-spin");
    const area = await page.locator(".slab-drag").boundingBox();
    await page.mouse.move(area!.x + area!.width / 2, area!.y + area!.height / 2);
    await page.mouse.down();
    await page.mouse.move(area!.x + area!.width / 2 + 100, area!.y + area!.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await box.evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  });
});
