import { ApiError, guestbookApi } from "./guestbook-api";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("guestbookApi", () => {
  it("lists a page, passing the cursor", async () => {
    const fetcher = vi.fn().mockImplementation(async () => reply(200, { messages: [{ id: 3, nickname: "a", body: "b", createdAt: 1 }], more: true }));
    const api = guestbookApi(fetcher);
    expect(await api.list(null)).toEqual({ messages: [{ id: 3, nickname: "a", body: "b", createdAt: 1 }], more: true });
    await api.list(42);
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(["/api/guestbook", "/api/guestbook?before=42"]);
  });

  it("posts JSON and returns the saved message", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(201, { message: { id: 9, nickname: "a", body: "b", createdAt: 5 } }));
    const saved = await guestbookApi(fetcher).post({ nickname: "a", body: "b", token: "t" });
    expect(saved.id).toBe(9);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/guestbook");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ nickname: "a", body: "b", token: "t" });
  });

  it("reports with an empty JSON body", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(204, null));
    await guestbookApi(fetcher).report(7);
    expect(fetcher.mock.calls[0][0]).toBe("/api/guestbook/7/report");
    expect(fetcher.mock.calls[0][1].body).toBe("{}");
  });

  it("turns API errors into ApiError with the code and retry time", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(429, { error: "too_fast", retryAfter: 12 }));
    const error = await guestbookApi(fetcher).post({ nickname: "a", body: "b", token: "t" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "too_fast", retryAfter: 12 });
  });

  it("treats network failures and non-JSON replies as a generic error", async () => {
    const down = guestbookApi(vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(down.list(null)).rejects.toMatchObject({ code: "network" });
    const html = guestbookApi(vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    await expect(html.list(null)).rejects.toMatchObject({ code: "server" });
  });

  it("rejects a list reply that does not look like messages", async () => {
    const api = guestbookApi(vi.fn().mockResolvedValue(reply(200, { messages: [{ id: "x" }], more: false })));
    await expect(api.list(null)).rejects.toMatchObject({ code: "server" });
  });
});
