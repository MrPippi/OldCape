import { ApiError, guestbookApi } from "./guestbook-api";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("guestbookApi", () => {
  it("lists a page, passing the cursor", async () => {
    const fetcher = vi.fn().mockImplementation(async () => reply(200, { messages: [{ id: 3, nickname: "a", body: "b", createdAt: 1 }], more: true }));
    const api = guestbookApi(fetcher);
    expect(await api.list({})).toEqual({ messages: [{ id: 3, nickname: "a", body: "b", createdAt: 1 }], more: true });
    await api.list({ before: 42 });
    await api.list({ after: 7 });
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(["/api/guestbook", "/api/guestbook?before=42", "/api/guestbook?after=7"]);
  });

  it("trades a Turnstile token for a chat pass", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(201, { session: "p.s", expiresAt: 99 }));
    expect(await guestbookApi(fetcher).session("tok")).toEqual({ session: "p.s", expiresAt: 99 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/chat/session");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ token: "tok" });
  });

  it("reports with an empty JSON body", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(204, null));
    await guestbookApi(fetcher).report(7);
    expect(fetcher.mock.calls[0][0]).toBe("/api/guestbook/7/report");
    expect(fetcher.mock.calls[0][1].body).toBe("{}");
  });

  it("turns API errors into ApiError with the code and retry time", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(429, { error: "too_fast", retryAfter: 12 }));
    const fetcher2 = vi.fn().mockResolvedValue(reply(403, { error: "captcha" }));
    const error = await guestbookApi(fetcher2).session("t").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "captcha", retryAfter: null });
    const limited = await guestbookApi(fetcher).list({}).catch((e: unknown) => e);
    expect(limited).toMatchObject({ code: "too_fast", retryAfter: 12 });
  });

  it("treats network failures and non-JSON replies as a generic error", async () => {
    const down = guestbookApi(vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(down.list({})).rejects.toMatchObject({ code: "network" });
    const html = guestbookApi(vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    await expect(html.list({})).rejects.toMatchObject({ code: "server" });
  });

  it("rejects a list reply that does not look like messages", async () => {
    const api = guestbookApi(vi.fn().mockResolvedValue(reply(200, { messages: [{ id: "x" }], more: false })));
    await expect(api.list({})).rejects.toMatchObject({ code: "server" });
  });
});
