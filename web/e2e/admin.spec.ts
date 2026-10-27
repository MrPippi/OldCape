import { expect, test } from "@playwright/test";

const rows = [
  { id: 3, nickname: "洗版仔", body: "垃圾訊息", createdAt: Date.now() - 60_000, hidden: true, reportCount: 3 },
  { id: 2, nickname: "阿明", body: "#12 是我的披風", createdAt: Date.now() - 3_600_000, hidden: false, reportCount: 0 },
];

test("moderators sign in, see hidden messages and hide one", async ({ page }) => {
  const calls: string[] = [];
  await page.route(/\/api\/admin\//, (route) => {
    const req = route.request();
    calls.push(`${req.method()} ${new URL(req.url()).pathname} ${req.headers().authorization ?? ""}`);
    if (req.headers().authorization !== `Bearer ${"k".repeat(40)}`) return route.fulfill({ status: 401, json: { error: "unauthorized" } });
    if (req.method() === "GET") return route.fulfill({ json: { messages: rows, more: false } });
    return route.fulfill({ status: 204 });
  });
  await page.goto("/admin.html");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toBe("noindex, nofollow");
  await page.getByLabel("管理密碼").fill("wrong");
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.locator(".adm-status")).toHaveText("管理密碼不對。");

  await page.getByLabel("管理密碼").fill("k".repeat(40));
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page.locator("tr[data-id]")).toHaveCount(2);
  await expect(page.locator('tr[data-id="3"] .adm-state')).toHaveText("已隱藏");
  await page.locator('tr[data-id="2"]').getByRole("button", { name: "隱藏" }).click();
  await expect(page.locator('tr[data-id="2"] .adm-state')).toHaveText("已隱藏");
  expect(calls.at(-1)).toBe(`POST /api/admin/messages/2/hide Bearer ${"k".repeat(40)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
