import { ApiError } from "./guestbook-api";
import type { GuestMessage } from "./guestbook-api";

export interface AdminMessage extends GuestMessage {
  hidden: boolean;
  reportCount: number;
}

export interface AdminApi {
  list(before: number | null): Promise<{ messages: AdminMessage[]; more: boolean }>;
  hide(id: number): Promise<void>;
  show(id: number): Promise<void>;
  remove(id: number): Promise<void>;
}

const BASE = "/api/admin/messages";

function isAdminMessage(m: unknown): m is AdminMessage {
  if (typeof m !== "object" || m === null) return false;
  const r = m as Record<string, unknown>;
  return (
    Number.isInteger(r.id) &&
    typeof r.nickname === "string" &&
    typeof r.body === "string" &&
    Number.isFinite(r.createdAt) &&
    typeof r.hidden === "boolean" &&
    Number.isInteger(r.reportCount)
  );
}

/** Moderation calls, authorised with the admin token (kept by the caller, never in the URL). */
export function adminApi(token: string, fetcher: typeof fetch = (input, init) => fetch(input, init)): AdminApi {
  async function call(url: string, method = "GET"): Promise<unknown> {
    let res: Response;
    try {
      res = await fetcher(url, { method, headers: { authorization: `Bearer ${token}` } });
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
      const code = (data as { error?: unknown } | null)?.error;
      throw new ApiError(typeof code === "string" ? code : "server");
    }
    return data;
  }

  return {
    async list(before) {
      const data = (await call(before === null ? BASE : `${BASE}?before=${before}`)) as { messages?: unknown; more?: unknown };
      if (!Array.isArray(data?.messages) || !data.messages.every(isAdminMessage) || typeof data.more !== "boolean") {
        throw new ApiError("server");
      }
      return { messages: data.messages, more: data.more };
    },
    async hide(id) {
      await call(`${BASE}/${id}/hide`, "POST");
    },
    async show(id) {
      await call(`${BASE}/${id}/show`, "POST");
    },
    async remove(id) {
      await call(`${BASE}/${id}`, "DELETE");
    },
  };
}
