import { SELF, env, fetchMock } from "cloudflare:test";
import { PAGE_SIZE, REPORTS_TO_HIDE } from "../store";

const BASE = "https://oldcape.org";
const SITEVERIFY = "https://challenges.cloudflare.com";

type Json = Record<string, unknown>;

function turnstile(success: boolean): void {
  fetchMock
    .get(SITEVERIFY)
    .intercept({ path: "/turnstile/v0/siteverify", method: "POST" })
    .reply(200, { success });
}

function post(path: string, body: unknown, ip = "1.1.1.1", contentType = "application/json"): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": contentType, "cf-connecting-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const message = (over: Json = {}) => ({ nickname: "阿明", body: "#12 是我的披風", token: "tok", ...over });
const list = async (query = ""): Promise<{ messages: Json[]; more: boolean }> =>
  (await SELF.fetch(`${BASE}/api/guestbook${query}`)).json();

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
beforeEach(async () => {
  await env.DB.exec("DELETE FROM reports; DELETE FROM messages;");
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("GET /api/guestbook", () => {
  it("starts empty and is never cached", async () => {
    const res = await SELF.fetch(`${BASE}/api/guestbook`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ messages: [], more: false });
  });

  it("pages newest first with a before= cursor", async () => {
    const insert = env.DB.prepare("INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES (?, ?, ?, 'x')");
    await env.DB.batch(Array.from({ length: PAGE_SIZE + 5 }, (_, i) => insert.bind(`n${i}`, `b${i}`, 1000 + i)));
    const first = await list();
    expect(first.messages).toHaveLength(PAGE_SIZE);
    expect(first.more).toBe(true);
    expect(first.messages[0]).toMatchObject({ nickname: `n${PAGE_SIZE + 4}`, createdAt: 1000 + PAGE_SIZE + 4 });
    expect(Object.keys(first.messages[0]).sort()).toEqual(["body", "createdAt", "id", "nickname"]);
    const rest = await list(`?before=${first.messages.at(-1)!.id}`);
    expect(rest.messages).toHaveLength(5);
    expect(rest.more).toBe(false);
  });

  it("rejects a malformed or doubled cursor", async () => {
    expect((await SELF.fetch(`${BASE}/api/guestbook?before=abc`)).status).toBe(400);
    expect((await SELF.fetch(`${BASE}/api/guestbook?before=1&after=1`)).status).toBe(400);
  });
});

describe("POST /api/guestbook", () => {
  it("is retired: speaking happens over the chat socket", async () => {
    expect((await post("/api/guestbook", message())).status).toBe(405);
  });
});

describe("POST /api/chat/session", () => {
  it("trades a Turnstile pass for a 6-hour chat pass", async () => {
    turnstile(true);
    const res = await post("/api/chat/session", { token: "tok" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { session: string; expiresAt: number };
    expect(body.session).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(body.expiresAt).toBeGreaterThan(Date.now() + 5 * 3_600_000);
  });

  it("refuses a failed or missing Turnstile check, and non-JSON", async () => {
    turnstile(false);
    expect((await post("/api/chat/session", { token: "bad" })).status).toBe(403);
    expect((await post("/api/chat/session", {})).status).toBe(403);
    expect((await post("/api/chat/session", "token=x", "1.1.1.1", "application/x-www-form-urlencoded")).status).toBe(415);
  });
});

describe("GET /api/chat/online", () => {
  it("reports how many people have the chat open", async () => {
    const res = await SELF.fetch(`${BASE}/api/chat/online`);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ online: expect.any(Number) });
  });
});

describe("POST /api/guestbook/:id/report", () => {
  async function seed(): Promise<number> {
    const row = await env.DB.prepare("INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES ('阿明', '嗨', 1, 'x') RETURNING id")
      .first<{ id: number }>();
    return row!.id;
  }

  it(`hides a message after ${REPORTS_TO_HIDE} different visitors report it`, async () => {
    const id = await seed();
    for (const ip of ["1.0.0.1", "1.0.0.2"]) expect((await post(`/api/guestbook/${id}/report`, {}, ip)).status).toBe(204);
    expect((await list()).messages).toHaveLength(1);
    await post(`/api/guestbook/${id}/report`, {}, "1.0.0.3");
    expect((await list()).messages).toHaveLength(0);
  });

  it("counts one visitor's repeated reports once", async () => {
    const id = await seed();
    for (let i = 0; i < REPORTS_TO_HIDE + 1; i++) await post(`/api/guestbook/${id}/report`, {}, "1.0.0.1");
    expect((await list()).messages).toHaveLength(1);
  });

  it("404s an unknown message and requires JSON", async () => {
    expect((await post("/api/guestbook/999/report", {})).status).toBe(404);
    const id = await seed();
    expect((await post(`/api/guestbook/${id}/report`, "", "1.1.1.1", "text/plain")).status).toBe(415);
  });
});

describe("routing", () => {
  it("404s unknown API paths and methods", async () => {
    expect((await SELF.fetch(`${BASE}/api/nope`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/api/guestbook`, { method: "DELETE" })).status).toBe(405);
    expect((await SELF.fetch(`${BASE}/api/chat`)).status).toBe(426);
  });

  it("hands every other path to the static site", async () => {
    expect(await (await SELF.fetch(`${BASE}/?cape=12`)).text()).toBe("static page");
  });
});
