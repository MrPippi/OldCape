export interface GuestMessage {
  id: number;
  nickname: string;
  body: string;
  createdAt: number;
}
export interface GuestPage {
  messages: GuestMessage[];
  more: boolean;
}
/** `before`: older page, newest first. `after`: what came after an id, oldest first. */
export interface ListCursor {
  before?: number;
  after?: number;
}
export interface GuestbookApi {
  list(cursor: ListCursor): Promise<GuestPage>;
  /** Trade a Turnstile token for a chat pass (lets this visitor speak for 6 hours). */
  session(token: string): Promise<{ session: string; expiresAt: number }>;
  report(id: number): Promise<void>;
}

/** `code` is the API's error code, or "network" / "server" when no usable reply came back. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfter: number | null = null,
  ) {
    super(`guestbook api: ${code}`);
  }
}

const BASE = "/api/guestbook";

function isMessage(m: unknown): m is GuestMessage {
  if (typeof m !== "object" || m === null) return false;
  const r = m as Record<string, unknown>;
  return Number.isInteger(r.id) && typeof r.nickname === "string" && typeof r.body === "string" && Number.isFinite(r.createdAt);
}

export function guestbookApi(fetcher: typeof fetch = (input, init) => fetch(input, init)): GuestbookApi {
  async function call(url: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await fetcher(url, init);
    } catch {
      throw new ApiError("network");
    }
    if (res.status === 204) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new ApiError("server");
    }
    if (!res.ok) {
      const r = (data ?? {}) as { error?: unknown; retryAfter?: unknown };
      throw new ApiError(typeof r.error === "string" ? r.error : "server", typeof r.retryAfter === "number" ? r.retryAfter : null);
    }
    return data;
  }
  const postJson = (url: string, body: unknown): Promise<unknown> =>
    call(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  return {
    async list(cursor) {
      const query = cursor.before !== undefined ? `?before=${cursor.before}` : cursor.after !== undefined ? `?after=${cursor.after}` : "";
      const data = (await call(`${BASE}${query}`)) as { messages?: unknown; more?: unknown };
      if (!Array.isArray(data?.messages) || !data.messages.every(isMessage) || typeof data.more !== "boolean") {
        throw new ApiError("server");
      }
      return { messages: data.messages, more: data.more };
    },
    async session(token) {
      const data = (await postJson("/api/chat/session", { token })) as { session?: unknown; expiresAt?: unknown };
      if (typeof data?.session !== "string" || typeof data.expiresAt !== "number") throw new ApiError("server");
      return { session: data.session, expiresAt: data.expiresAt };
    },
    async report(id) {
      await postJson(`${BASE}/${id}/report`, {});
    },
  };
}
