import { expect, test } from "@playwright/test";
import type { Page, WebSocketRoute } from "@playwright/test";

const TURNSTILE_STUB = `window.turnstile = {
  render(el, o) { const d = document.createElement("div"); d.className = "ts-stub"; d.textContent = "已驗證"; el.append(d); setTimeout(() => o.callback("e2e-token")); return "w1"; },
  reset() {}
};`;

interface Fake {
  sockets: WebSocketRoute[];
  said: unknown[];
  requests: string[];
  push(message: { id: number; nickname: string; body: string }): void;
}

/** History API, Turnstile, the pass endpoint and the chat room itself, all faked in the page. */
async function fakeChat(page: Page): Promise<Fake> {
  const fake: Fake = { sockets: [], said: [], requests: [], push: () => undefined };
  let nextId = 10;
  const history = [
    { id: 2, nickname: "阿明", body: "#12 是我當年的披風！", createdAt: Date.now() - 3_600_000 },
    { id: 1, nickname: "小美", body: "好懷念台灣麥塊", createdAt: Date.now() - 86_400_000 },
  ];
  page.on("request", (r) => {
    if (/chat-panel|\/api\/|turnstile/.test(r.url())) fake.requests.push(new URL(r.url()).pathname);
  });
  await page.route(/challenges\.cloudflare\.com\/turnstile/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }),
  );
  await page.route(/\/api\/chat\/online$/, (route) => route.fulfill({ json: { online: 2 } }));
  await page.route(/\/api\/chat\/session$/, (route) => route.fulfill({ status: 201, json: { session: "pass.sig", expiresAt: Date.now() + 6 * 3_600_000 } }));
  await page.route(/\/api\/guestbook(\?|$)/, (route) => {
    const after = new URL(route.request().url()).searchParams.get("after");
    return route.fulfill({ json: { messages: after ? [] : history, more: false } });
  });
  await page.routeWebSocket(/\/api\/chat(\?|$)/, (ws) => {
    fake.sockets.push(ws);
    const canSpeak = new URL(ws.url()).searchParams.get("session") === "pass.sig";
    ws.send(JSON.stringify({ type: "hello", online: 2, canSpeak }));
    ws.onMessage((raw) => {
      const say = JSON.parse(String(raw)) as { nickname: string; body: string; nonce: string };
      fake.said.push(say);
      if (!canSpeak) return ws.send(JSON.stringify({ type: "error", code: "need_session", nonce: say.nonce }));
      ws.send(JSON.stringify({ type: "message", nonce: say.nonce, message: { id: nextId++, nickname: say.nickname, body: say.body, createdAt: Date.now() } }));
    });
  });
  fake.push = (m) => {
    for (const ws of fake.sockets) ws.send(JSON.stringify({ type: "message", message: { ...m, createdAt: Date.now() } }));
  };
  return fake;
}

const fab = (page: Page) => page.locator(".chat-fab");
const panel = (page: Page) => page.getByRole("dialog", { name: "聊天室" });

test("no chat code or connection until the button is pressed; the badge shows who is online", async ({ page }) => {
  const fake = await fakeChat(page);
  await page.goto("/");
  await expect(page.locator(".card").nth(63)).toBeAttached();
  await expect(page.locator(".chat-badge")).toHaveText("2");
  expect(fake.requests).toEqual(["/api/chat/online"]);
  expect(fake.sockets).toHaveLength(0);
  await fab(page).click();
  await expect(panel(page).locator(".chat-item")).toHaveCount(2);
  await expect(panel(page).locator(".chat-state")).toHaveText("2 人在線");
  expect(fake.sockets).toHaveLength(1);
});

test("first message: human check, then it sends by itself and shows up", async ({ page }) => {
  const fake = await fakeChat(page);
  await page.goto("/");
  await fab(page).click();
  const chat = panel(page);
  await expect(chat.locator(".chat-item").last()).toContainText("#12 是我當年的披風");
  await chat.getByLabel("暱稱").fill("老玩家");
  await chat.getByLabel("訊息", { exact: true }).fill("大家好 #15");
  await chat.getByLabel("訊息", { exact: true }).press("Enter");
  await expect(chat.locator(".chat-item").last()).toContainText("大家好 #15");
  await expect(chat.getByLabel("訊息", { exact: true })).toHaveValue("");
  expect(fake.said).toEqual([{ type: "say", nickname: "老玩家", body: "大家好 #15", nonce: expect.any(String) }]);
  expect(fake.sockets).toHaveLength(2); // reconnected with the pass
  await chat.getByLabel("訊息", { exact: true }).fill("第二句");
  await chat.getByRole("button", { name: "送出" }).click();
  await expect(chat.locator(".chat-item").last()).toContainText("第二句");
});

test("other people's messages appear live", async ({ page }) => {
  const fake = await fakeChat(page);
  await page.goto("/");
  await fab(page).click();
  await expect(panel(page).locator(".chat-item")).toHaveCount(2);
  fake.push({ id: 50, nickname: "路人", body: "有人在嗎？" });
  await expect(panel(page).locator(".chat-item").last()).toContainText("有人在嗎？");
});

test("a #id opens that cape", async ({ page }) => {
  await fakeChat(page);
  await page.goto("/#chat");
  const link = panel(page).locator("a.cape-ref").first();
  await expect(link).toHaveText("#12");
  const mini = await link.locator(".cape").evaluate((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
  expect(mini).toEqual([10, 16]);
  await link.click();
  await expect(page.locator(".detail h2")).toHaveText("#12");
});

test("old /#guestbook links open the chat", async ({ page }) => {
  await fakeChat(page);
  await page.goto("/#guestbook");
  await expect(panel(page)).toBeVisible();
});

test.describe("375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the chat is full screen, and the button steps aside for it and for the cape sheet", async ({ page }) => {
    await fakeChat(page);
    await page.goto("/");
    await fab(page).click();
    const box = await panel(page).boundingBox();
    expect([Math.round(box!.x), Math.round(box!.y), Math.round(box!.width), Math.round(box!.height)]).toEqual([0, 0, 375, 812]);
    await expect(fab(page)).toBeHidden();
    await panel(page).locator("a.cape-ref").first().click();
    await expect(page.locator(".detail")).toBeVisible();
    await expect(panel(page)).toBeHidden();
    await expect(fab(page)).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(fab(page)).toBeVisible();
  });
});
