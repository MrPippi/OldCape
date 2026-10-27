import { expect, test } from "@playwright/test";

const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2713}\u{2715}]/u;

test("buttons use the icon sprite, not emoji, and every icon resolves", async ({ page }) => {
  await page.goto("/?cape=12");
  await expect(page.locator(".detail")).toBeVisible();
  const texts = [await page.locator("body").innerText()];
  await page.keyboard.press("Escape");
  for (const id of ["how", "about"]) {
    await page.goto(`/#${id}`);
    texts.push(await page.locator(`#${id}`).innerText());
  }
  for (const t of texts) expect(t).not.toMatch(EMOJI);

  await page.goto("/?cape=12");
  await expect(page.locator(".detail .ic").first()).toBeVisible();
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll("svg.ic use")]
      .map((u) => u.getAttribute("href") ?? "")
      .filter((href) => !document.querySelector(`symbol${href}`)),
  );
  expect(missing).toEqual([]);
  expect(await page.locator("svg.ic").count()).toBeGreaterThanOrEqual(5);
});
