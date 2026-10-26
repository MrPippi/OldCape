import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    test("nav opens 怎麼穿上 in place instead of jumping down past the wall", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".card").nth(63)).toBeAttached();
      const link = page.getByRole("navigation", { name: "主選單" }).getByRole("link", { name: "怎麼穿上" });
      await link.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => window.scrollY);

      await link.click();
      const how = page.getByRole("dialog", { name: "怎麼穿上？" });
      await expect(how).toBeVisible();
      const box = await how.boundingBox();
      expect(box && box.y >= 0 && box.y + box.height <= 812).toBe(true);

      await page.keyboard.press("Escape");
      await expect(how).toBeHidden();
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });
  });
}

test("關於 opens from the nav with the full-set zip link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "主選單" }).getByRole("link", { name: "關於" }).click();
  const about = page.getByRole("dialog", { name: "關於老披風" });
  await expect(about).toBeVisible();
  await expect(about.locator("#release-zip")).toHaveAttribute(
    "href",
    "https://github.com/MrPippi/OldCape/releases/download/v1.0.0/oldcape-capes.zip",
  );
  await about.getByRole("button", { name: "關閉" }).click();
  await expect(about).toBeHidden();
  expect(new URL(page.url()).hash).toBe("");
});

test("a /#how link opens the dialog on arrival", async ({ page }) => {
  await page.goto("/#how");
  await expect(page.getByRole("dialog", { name: "怎麼穿上？" })).toBeVisible();
});

test("怎麼穿上 points to a mod that accepts the downloaded PNG", async ({ page }) => {
  await page.goto("/#how");
  const how = page.getByRole("dialog", { name: "怎麼穿上？" });
  await expect(how.getByRole("link", { name: "SkinMC 模組" })).toHaveAttribute("href", "https://modrinth.com/mod/skinmc");
  await expect(how.getByRole("link", { name: "SkinMC 模組" })).toHaveCSS("color", "rgb(240, 198, 116)");
});
