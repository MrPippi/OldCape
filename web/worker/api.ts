import type { Env } from "./env";
import { issueSession, readSession } from "./session";
import { listMessages, reportMessage } from "./store";
import { verifyTurnstile } from "./turnstile";

const MAX_REQUEST_BYTES = 4096;

const json = (status: number, data: unknown, headers: Record<string, string> = {}): Response =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
const fail = (status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json(status, { error, ...extra }, headers);

async function sourceHash(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** JSON-only bodies: a cross-site HTML form can't send application/json without a CORS preflight. */
async function readJson(req: Request): Promise<{ data: Record<string, unknown> } | { res: Response }> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { res: fail(415, "bad_request") };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BYTES) return { res: fail(413, "bad_request") };
  try {
    const data: unknown = text ? JSON.parse(text) : {};
    if (typeof data !== "object" || data === null || Array.isArray(data)) return { res: fail(400, "bad_request") };
    return { data: data as Record<string, unknown> };
  } catch {
    return { res: fail(400, "bad_request") };
  }
}

const CURSOR = /^\d{1,12}$/;

async function list(url: URL, env: Env): Promise<Response> {
  const before = url.searchParams.get("before");
  const after = url.searchParams.get("after");
  if ((before !== null && after !== null) || [before, after].some((c) => c !== null && !CURSOR.test(c))) {
    return fail(400, "bad_request");
  }
  return json(200, await listMessages(env.DB, { before: before === null ? null : Number(before), after: after === null ? null : Number(after) }));
}

/**
 * Call the one chat room. A deploy resets Durable Objects and in-flight calls fail with
 * "please retry"; every call here is safe to repeat, so retry once on a fresh stub.
 */
async function roomFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const call = () => env.CHAT.get(env.CHAT.idFromName("lobby")).fetch(`https://chat${path}`, init);
  try {
    return await call();
  } catch (error) {
    console.warn("chat: room call failed, retrying once", path, error);
    return call();
  }
}

/** Turnstile once, then a signed 6-hour pass that lets this visitor speak in the chat. */
async function startSession(req: Request, env: Env, ip: string, now: number): Promise<Response> {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const token = typeof parsed.data.token === "string" ? parsed.data.token : "";
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) return fail(403, "captcha");
  const { token: session, expiresAt } = await issueSession(env.SESSION_KEY, now);
  return json(201, { session, expiresAt });
}

/** Hand the socket to the room, with the server-computed source and whether it may speak. */
async function joinChat(req: Request, url: URL, env: Env, ip: string, now: number): Promise<Response> {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return fail(426, "bad_request");
  const pass = url.searchParams.get("session");
  const canSpeak = pass !== null && (await readSession(pass, env.SESSION_KEY, now)) !== null;
  return roomFetch(env, "/ws", {
    headers: { upgrade: "websocket", "x-ip-hash": await sourceHash(ip, env.IP_SALT), "x-can-speak": canSpeak ? "1" : "0" },
  });
}

async function online(env: Env): Promise<Response> {
  const res = await roomFetch(env, "/online");
  return json(200, await res.json());
}

async function report(req: Request, env: Env, id: number, ip: string, now: number): Promise<Response> {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const outcome = await reportMessage(env.DB, id, await sourceHash(ip, env.IP_SALT), now);
  if (outcome === "not_found") return fail(404, "not_found");
  if (outcome === "hidden") await roomFetch(env, "/hidden", { method: "POST", body: JSON.stringify({ id }) });
  return json(204, null);
}

export async function handleApi(req: Request, env: Env, now: number = Date.now()): Promise<Response> {
  const url = new URL(req.url);
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  try {
    if (url.pathname === "/api/guestbook") {
      // Posting moved to the chat socket; this stays as the history reader.
      if (req.method === "GET") return await list(url, env);
      return fail(405, "bad_request", {}, { allow: "GET" });
    }
    if (url.pathname === "/api/chat") return await joinChat(req, url, env, ip, now);
    if (url.pathname === "/api/chat/online" && req.method === "GET") return await online(env);
    if (url.pathname === "/api/chat/session") {
      if (req.method === "POST") return await startSession(req, env, ip, now);
      return fail(405, "bad_request", {}, { allow: "POST" });
    }
    const reportPath = /^\/api\/guestbook\/(\d{1,12})\/report$/.exec(url.pathname);
    if (reportPath) {
      if (req.method !== "POST") return fail(405, "bad_request", {}, { allow: "POST" });
      return await report(req, env, Number(reportPath[1]), ip, now);
    }
    return fail(404, "not_found");
  } catch (error) {
    console.error("guestbook: request failed", req.method, url.pathname, error);
    return fail(500, "server");
  }
}
