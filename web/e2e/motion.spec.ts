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

test.describe("press feedback", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("buttons and cards sink slightly while pressed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card").nth(63)).toBeAttached();
    for (const sel of [".hero .b1", "[data-action=random] >> nth=0", ".card >> nth=0"]) {
      const el = page.locator(sel);
      const box = (await el.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect.poll(() => el.evaluate((e) => getComputedStyle(e).scale), { message: sel }).toBe("0.97");
      await page.mouse.up();
      await page.keyboard.press("Escape");
    }
  });
});

test("the wall shows placeholder cards, not just text, while capes load", async ({ page }) => {
  await page.route(/\/data\/index\.json(\?|$)/, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".wall.skeleton .card.ph").first()).toBeVisible();
  await expect(page.locator(".card").nth(63)).toBeAttached();
  await expect(page.locator(".wall.skeleton")).toHaveCount(0);
});
