import { SELF, env } from "cloudflare:test";

const BASE = "https://oldcape.org";
const TOKEN = env.ADMIN_TOKEN!;

function admin(path: string, init: RequestInit = {}, token: string | null = TOKEN): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return SELF.fetch(`${BASE}/api/admin${path}`, { ...init, headers });
}

async function seed(): Promise<{ visible: number; hidden: number }> {
  const insert = env.DB.prepare(
    "INSERT INTO messages (nickname, body, created_at, ip_hash, hidden, report_count) VALUES (?, ?, ?, 'x', ?, ?) RETURNING id",
  );
  const visible = (await insert.bind("阿明", "嗨", 1, 0, 1).first<{ id: number }>())!.id;
  const hidden = (await insert.bind("洗版", "垃圾", 2, 1, 3).first<{ id: number }>())!.id;
  return { visible, hidden };
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM reports; DELETE FROM messages;");
});

describe("/api/admin", () => {
  it("refuses requests without the right token", async () => {
    expect((await admin("/messages", {}, null)).status).toBe(401);
    expect((await admin("/messages", {}, "x".repeat(40))).status).toBe(401);
    expect((await admin("/messages", {}, `${TOKEN}x`)).status).toBe(401);
  });

  it("lists every message, hidden ones too, with report counts, never cached", async () => {
    const { visible, hidden } = await seed();
    const res = await admin("/messages");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { messages: Array<Record<string, unknown>>; more: boolean };
    expect(body.more).toBe(false);
    expect(body.messages.map((m) => [m.id, m.hidden, m.reportCount])).toEqual([
      [hidden, true, 3],
      [visible, false, 1],
    ]);
  });

  it("hides, shows and deletes", async () => {
    const { visible, hidden } = await seed();
    expect((await admin(`/messages/${visible}/hide`, { method: "POST" })).status).toBe(204);
    expect((await admin(`/messages/${hidden}/show`, { method: "POST" })).status).toBe(204);
    const publicList = (await (await SELF.fetch(`${BASE}/api/guestbook`)).json()) as { messages: Array<{ id: number }> };
    expect(publicList.messages.map((m) => m.id)).toEqual([hidden]);
    const shown = await env.DB.prepare("SELECT report_count FROM messages WHERE id = ?").bind(hidden).first<{ report_count: number }>();
    expect(shown!.report_count).toBe(0); // shown again = reports cleared

    expect((await admin(`/messages/${visible}`, { method: "DELETE" })).status).toBe(204);
    expect(await env.DB.prepare("SELECT 1 FROM messages WHERE id = ?").bind(visible).first()).toBeNull();
    expect((await admin(`/messages/${visible}`, { method: "DELETE" })).status).toBe(404);
    expect((await admin("/messages/999/hide", { method: "POST" })).status).toBe(404);
  });

  it("rejects unknown admin routes and methods", async () => {
    expect((await admin("/nope")).status).toBe(404);
    expect((await admin("/messages/1/hide")).status).toBe(405);
  });
});
