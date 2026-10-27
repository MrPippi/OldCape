import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const TURNSTILE_STUB = `window.turnstile = {
  render(el, o) { const d = document.createElement("div"); d.className = "ts-stub"; d.textContent = "已驗證"; el.append(d); setTimeout(() => o.callback("e2e-token")); return "w1"; },
  reset() {}
};`;

interface Fake {
  calls: string[];
  posted: unknown[];
}

/** In-memory guestbook API and an always-pass Turnstile, so the page runs without the Worker. */
async function fakeBackend(page: Page): Promise<Fake> {
  const fake: Fake = { calls: [], posted: [] };
  let messages = [
    { id: 2, nickname: "阿明", body: "#12 是我當年的披風！", createdAt: Date.now() - 3_600_000 },
    { id: 1, nickname: "小美", body: "好懷念台灣麥塊", createdAt: Date.now() - 86_400_000 * 3 },
  ];
  await page.route(/challenges\.cloudflare\.com\/turnstile/, (route) => {
    fake.calls.push("turnstile");
    return route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB });
  });
  await page.route(/\/api\/guestbook/, async (route) => {
    const req = route.request();
    fake.calls.push(`${req.method()} ${new URL(req.url()).pathname}`);
    if (req.method() === "GET") return route.fulfill({ json: { messages, more: false } });
    if (req.url().endsWith("/report")) return route.fulfill({ status: 204 });
    const input = req.postDataJSON() as { nickname: string; body: string; token: string };
    fake.posted.push(input);
    const saved = { id: 3, nickname: input.nickname, body: input.body, createdAt: Date.now() };
    messages = [saved, ...messages];
    return route.fulfill({ status: 201, json: { message: saved } });
  });
  return fake;
}

const openGuestbook = (page: Page) =>
  page.getByRole("navigation", { name: "主選單" }).getByRole("link", { name: "留言板" }).click();

test("nothing guestbook-related loads until the dialog opens", async ({ page }) => {
  const fake = await fakeBackend(page);
  await page.goto("/");
  await expect(page.locator(".card").nth(63)).toBeAttached();
  await page.waitForLoadState("networkidle");
  expect(fake.calls).toEqual([]);
  await openGuestbook(page);
  await expect(page.locator(".gb-item")).toHaveCount(2);
  expect(fake.calls).toContain("turnstile");
});

test("read, post, and see the new message on top; the nickname is remembered", async ({ page }) => {
  const fake = await fakeBackend(page);
  await page.goto("/");
  await openGuestbook(page);
  const dialog = page.getByRole("dialog", { name: "留言板" });
  await expect(dialog.locator(".gb-item").first()).toContainText("#12 是我當年的披風");
  await expect(dialog.locator(".ts-stub")).toBeVisible();
  await dialog.getByLabel("暱稱").fill("老玩家");
  await dialog.getByLabel("留言", { exact: true }).fill("我也有一件 #15");
  await dialog.getByRole("button", { name: "送出" }).click();
  await expect(dialog.locator(".gb-item").first()).toContainText("我也有一件 #15");
  await expect(dialog.locator(".gb-status")).toHaveText("已送出，謝謝你的留言！");
  expect(fake.posted).toEqual([{ nickname: "老玩家", body: "我也有一件 #15", token: "e2e-token" }]);

  await page.reload();
  await openGuestbook(page);
  await expect(page.getByRole("dialog", { name: "留言板" }).getByLabel("暱稱")).toHaveValue("老玩家");
});

test("a #id in a message shows the mini cape and opens that cape", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/#guestbook");
  const link = page.locator(".gb-item a.cape-ref").first();
  await expect(link).toHaveText("#12");
  const mini = await link.locator(".cape").evaluate((e) => {
    const r = e.getBoundingClientRect();
    return [r.width, r.height, getComputedStyle(e).imageRendering];
  });
  expect(mini).toEqual([10, 16, "pixelated"]);
  await link.click();
  await expect(page.getByRole("dialog", { name: "留言板" })).toBeHidden();
  await expect(page.locator(".detail h2")).toHaveText("#12");
});

test.describe("375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the guestbook sheet fits the phone and its form is usable", async ({ page }) => {
    await fakeBackend(page);
    await page.goto("/#guestbook");
    const dialog = page.getByRole("dialog", { name: "留言板" });
    await expect(dialog.locator(".gb-item")).toHaveCount(2);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    const overflow = await dialog.evaluate((d) => d.scrollWidth - d.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(dialog.getByRole("button", { name: "送出" })).toBeVisible();
    // bottom sheet like the other dialogs: full width, flush with the bottom edge
    expect(Math.round(box!.width)).toBe(375);
    expect(Math.round(box!.y + box!.height)).toBe(812);
  });

  test("the header keeps the logo and every menu item on one line", async ({ page }) => {
    await page.goto("/");
    const heights = await page.locator("header.nav a").evaluateAll((els) =>
      els.map((e) => [e.textContent, e.getBoundingClientRect().height, parseFloat(getComputedStyle(e).lineHeight) || 24]),
    );
    for (const [text, height, line] of heights) expect(height, `${text}`).toBeLessThan((line as number) * 1.5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
