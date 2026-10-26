import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { INDEX, RED, colorsOf, nonBlank, pngSize } from "./helpers";

test("home shows the real total and today's cape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-stat=total]")).toHaveText(INDEX.total.toLocaleString("en-US"));
  await expect(page.locator(".ped em")).toHaveText(/^#\d+$/);
  await expect(page.locator(".card").nth(63)).toBeAttached();
});

test("id search opens the cape; alias resolves to canonical", async ({ page }) => {
  await page.goto("/");
  const target = INDEX.capes[100][0];
  await page.getByLabel("披風編號").fill(`#${target}`);
  await page.getByRole("button", { name: "找", exact: true }).click();
  await expect(page.locator("#detail-title")).toHaveText(`#${target}`);
  await expect(page).toHaveURL(`/?cape=${target}`);

  await page.keyboard.press("Escape");
  const [alias, canonical] = INDEX.aliases[0];
  await page.getByLabel("披風編號").fill(String(alias));
  await page.getByRole("button", { name: "找", exact: true }).click();
  await expect(page.locator("#detail-title")).toHaveText(`#${canonical}`);
});

test("unknown id shows a message", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("披風編號").fill("abc");
  await page.getByRole("button", { name: "找", exact: true }).click();
  await expect(page.locator(".msg")).toContainText("沒有這個編號");
});

test("colour filter narrows the wall to matching capes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "紅", exact: true }).click();
  const expected = nonBlank.filter((c) => (c[1] & RED) === RED).length;
  await expect(page.locator(".cnt")).toHaveText(`符合 ${expected.toLocaleString("en-US")} 件`);
  const ids = await page.locator(".card").evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.id)));
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect((colorsOf.get(id)! & RED) === RED).toBe(true);
});

test("download produces a 64x32 PNG named after the cape", async ({ page }) => {
  const id = nonBlank[5][0];
  await page.goto(`/?cape=${id}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /下載遊戲貼圖/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`oldcape-${id}.png`);
  const buf = readFileSync((await download.path())!);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  expect(pngSize(buf)).toEqual([64, 32]);
});

test("deep link opens the detail and back closes it", async ({ page }) => {
  await page.goto("/");
  await page.locator(".card").first().click();
  await expect(page.locator(".detail")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".detail")).toHaveCount(0);
});

test("failed index load offers a working retry", async ({ page }) => {
  let fail = true;
  await page.route(/\/data\/index\.json(\?|$)/, (route) => (fail ? route.abort() : route.continue()));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("載入失敗");
  fail = false;
  await page.getByRole("button", { name: "重試" }).click();
  await expect(page.locator(".card").nth(63)).toBeAttached();
});

