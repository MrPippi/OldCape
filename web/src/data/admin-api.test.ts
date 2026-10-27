import { adminApi } from "./admin-api";

const reply = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const row = { id: 3, nickname: "a", body: "b", createdAt: 1, hidden: true, reportCount: 2 };

describe("adminApi", () => {
  it("sends the token and lists messages with moderation fields", async () => {
    const fetcher = vi.fn().mockImplementation(async () => reply(200, { messages: [row], more: true }));
    const api = adminApi("tok", fetcher);
    expect(await api.list(null)).toEqual({ messages: [row], more: true });
    await api.list(9);
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(["/api/admin/messages", "/api/admin/messages?before=9"]);
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer tok");
  });

  it("hides, shows and deletes", async () => {
    const fetcher = vi.fn().mockImplementation(async () => reply(204, null));
    const api = adminApi("tok", fetcher);
    await api.hide(4);
    await api.show(4);
    await api.remove(4);
    expect(fetcher.mock.calls.map((c) => [c[0], c[1].method])).toEqual([
      ["/api/admin/messages/4/hide", "POST"],
      ["/api/admin/messages/4/show", "POST"],
      ["/api/admin/messages/4", "DELETE"],
    ]);
  });

  it("reports why it was refused", async () => {
    await expect(adminApi("bad", vi.fn().mockResolvedValue(reply(401, { error: "unauthorized" }))).list(null)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(adminApi("x", vi.fn().mockResolvedValue(reply(503, { error: "admin_disabled" }))).list(null)).rejects.toMatchObject({ code: "admin_disabled" });
    await expect(adminApi("x", vi.fn().mockRejectedValue(new TypeError("offline"))).hide(1)).rejects.toMatchObject({ code: "network" });
  });

  it("rejects a malformed list", async () => {
    const api = adminApi("tok", vi.fn().mockResolvedValue(reply(200, { messages: [{ id: 1 }], more: false })));
    await expect(api.list(null)).rejects.toMatchObject({ code: "server" });
  });
});
