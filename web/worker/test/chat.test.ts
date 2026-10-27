import { SELF, env, fetchMock } from "cloudflare:test";

const BASE = "https://oldcape.org";

type Event = { type: string; [k: string]: unknown };

/** A client socket that queues every event so tests can await them in order. */
class Client {
  private queue: Event[] = [];
  private waiters: Array<(e: Event) => void> = [];
  constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (m) => {
      const event = JSON.parse(m.data as string) as Event;
      const waiter = this.waiters.shift();
      if (waiter) waiter(event);
      else this.queue.push(event);
    });
  }
  next(): Promise<Event> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      this.waiters.push(resolve);
      setTimeout(() => reject(new Error("no event within 2s")), 2000);
    });
  }
  async nextOf(type: string): Promise<Event> {
    for (;;) {
      const e = await this.next();
      if (e.type === type) return e;
    }
  }
  say(body: string, nonce = "n1", nickname = "阿明"): void {
    this.ws.send(JSON.stringify({ type: "say", nickname, body, nonce }));
  }
}

const open: Client[] = [];

async function connect(session?: string, ip = "1.1.1.1"): Promise<Client> {
  const res = await SELF.fetch(`${BASE}/api/chat${session ? `?session=${encodeURIComponent(session)}` : ""}`, {
    headers: { upgrade: "websocket", "cf-connecting-ip": ip },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const client = new Client(ws);
  open.push(client);
  return client;
}

async function pass(): Promise<string> {
  fetchMock.get("https://challenges.cloudflare.com").intercept({ path: "/turnstile/v0/siteverify", method: "POST" }).reply(200, { success: true });
  const res = await SELF.fetch(`${BASE}/api/chat/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "tok" }),
  });
  return ((await res.json()) as { session: string }).session;
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
beforeEach(async () => {
  await env.DB.exec("DELETE FROM reports; DELETE FROM messages;");
});
afterEach(async () => {
  for (const c of open.splice(0)) c.ws.close(1000, "test done");
  await new Promise((r) => setTimeout(r, 50));
});

describe("chat socket", () => {
  it("lets anyone read, but asks for a pass before speaking", async () => {
    const reader = await connect();
    expect(await reader.next()).toMatchObject({ type: "hello", canSpeak: false, online: expect.any(Number) });
    reader.say("嗨");
    expect(await reader.nextOf("error")).toEqual({ type: "error", code: "need_session", nonce: "n1" });
  });

  it("treats a forged or expired pass as read-only instead of refusing the connection", async () => {
    const reader = await connect("forged.pass");
    expect(await reader.next()).toMatchObject({ type: "hello", canSpeak: false });
  });

  it("broadcasts a message to everyone, echoing the nonce only to the sender, and stores it", async () => {
    const speaker = await connect(await pass(), "1.1.1.1");
    expect(await speaker.next()).toMatchObject({ type: "hello", canSpeak: true });
    const listener = await connect(undefined, "2.2.2.2");
    await listener.nextOf("hello");

    speaker.say("  #12 是我的披風  ", "abc");
    const mine = await speaker.nextOf("message");
    const theirs = await listener.nextOf("message");
    expect(mine).toMatchObject({ nonce: "abc", message: { nickname: "阿明", body: "#12 是我的披風" } });
    expect(theirs).toEqual({ type: "message", message: mine.message });

    const stored = (await (await SELF.fetch(`${BASE}/api/guestbook`)).json()) as { messages: unknown[] };
    expect(stored.messages).toEqual([mine.message]);
  });

  it("rejects an invalid message to the sender only", async () => {
    const speaker = await connect(await pass());
    await speaker.nextOf("hello");
    speaker.say("看 https://spam.example", "x1");
    expect(await speaker.nextOf("error")).toEqual({ type: "error", code: "has_link", nonce: "x1" });
  });

  it("rate-limits a fast talker", async () => {
    const speaker = await connect(await pass());
    await speaker.nextOf("hello");
    speaker.say("一", "a");
    await speaker.nextOf("message");
    speaker.say("二", "b");
    expect(await speaker.nextOf("error")).toMatchObject({ code: "too_fast", nonce: "b", retryAfter: expect.any(Number) });
  });

  it("ignores frames that are not valid chat events", async () => {
    const speaker = await connect(await pass());
    await speaker.nextOf("hello");
    speaker.ws.send("not json");
    speaker.ws.send(JSON.stringify({ type: "dance" }));
    speaker.ws.send("x".repeat(5000));
    expect(await speaker.nextOf("error")).toMatchObject({ code: "bad_request" });
  });

  it("tells everyone how many are online as people come and go", async () => {
    const first = await connect();
    const hello = await first.nextOf("hello");
    const base = hello.online as number;
    const second = await connect(undefined, "2.2.2.2");
    await second.nextOf("hello");
    expect(await first.nextOf("online")).toEqual({ type: "online", count: base + 1 });
    second.ws.close(1000, "bye");
    open.splice(open.indexOf(second), 1);
    expect(await first.nextOf("online")).toEqual({ type: "online", count: base });
  });

  it("removes a message from every screen when reports hide it", async () => {
    const watcher = await connect();
    await watcher.nextOf("hello");
    const row = await env.DB.prepare("INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES ('a', 'b', 1, 'x') RETURNING id").first<{ id: number }>();
    for (const ip of ["9.0.0.1", "9.0.0.2", "9.0.0.3"]) {
      await SELF.fetch(`${BASE}/api/guestbook/${row!.id}/report`, {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": ip },
        body: "{}",
      });
    }
    expect(await watcher.nextOf("hidden")).toEqual({ type: "hidden", id: row!.id });
  });

  it("removes a message from every screen when a moderator hides or deletes it", async () => {
    const watcher = await connect();
    await watcher.nextOf("hello");
    const insert = env.DB.prepare("INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES ('a', 'b', 1, 'x') RETURNING id");
    const one = (await insert.first<{ id: number }>())!.id;
    const two = (await insert.first<{ id: number }>())!.id;
    const auth = { authorization: `Bearer ${env.ADMIN_TOKEN}` };
    await SELF.fetch(`${BASE}/api/admin/messages/${one}/hide`, { method: "POST", headers: auth });
    expect(await watcher.nextOf("hidden")).toEqual({ type: "hidden", id: one });
    await SELF.fetch(`${BASE}/api/admin/messages/${two}`, { method: "DELETE", headers: auth });
    expect(await watcher.nextOf("hidden")).toEqual({ type: "hidden", id: two });
  });
});
