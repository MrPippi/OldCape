import { expect, test } from "@playwright/test";

const animationOf = (sel: string) => (page: import("@playwright/test").Page) =>
  page.locator(sel).first().evaluate((e) => getComputedStyle(e).animationName);

test.describe("motion on", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the featured cape moves in a breeze from its rod", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".stage .rod")).toBeVisible();
    expect(await animationOf(".stage-cape .cape")(page)).toBe("breeze");
  });

  test("wall cards fade in and hovering one flips it to the back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card").nth(63)).toBeAttached();
    expect(await animationOf(".card")(page)).toBe("card-in");
    const card = page.locator(".card").first();
    await card.hover();
    await expect
      .poll(() => card.locator(".flip").evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m11))
      .toBeLessThan(-0.99);
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

  test("nothing animates on its own", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card").nth(63)).toBeAttached();
    expect(await animationOf(".stage-cape .cape")(page)).toBe("none");
    expect(await animationOf(".card")(page)).toBe("none");
    expect(await animationOf(".card .flip")(page)).toBe("none");
  });
});
