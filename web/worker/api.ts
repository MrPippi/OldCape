import type { Env } from "./env";
import { checkRate, insertMessage, listMessages, reportMessage } from "./store";
import { verifyTurnstile } from "./turnstile";
import { validateMessage } from "./validate";

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

async function list(url: URL, env: Env): Promise<Response> {
  const raw = url.searchParams.get("before");
  if (raw !== null && !/^\d{1,12}$/.test(raw)) return fail(400, "bad_request");
  return json(200, await listMessages(env.DB, raw === null ? null : Number(raw)));
}

async function create(req: Request, env: Env, ip: string, now: number): Promise<Response> {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const checked = validateMessage({ nickname: parsed.data.nickname, body: parsed.data.body });
  if (!checked.ok) return fail(400, checked.error);
  const ipHash = await sourceHash(ip, env.IP_SALT);
  const limited = await checkRate(env.DB, ipHash, now);
  if (limited) {
    return fail(429, limited.error, { retryAfter: limited.retryAfter }, { "retry-after": String(limited.retryAfter) });
  }
  const token = typeof parsed.data.token === "string" ? parsed.data.token : "";
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) return fail(403, "captcha");
  const message = await insertMessage(env.DB, { nickname: checked.nickname, body: checked.body, ipHash }, now);
  return json(201, { message });
}

async function report(req: Request, env: Env, id: number, ip: string, now: number): Promise<Response> {
  const parsed = await readJson(req);
  if ("res" in parsed) return parsed.res;
  const outcome = await reportMessage(env.DB, id, await sourceHash(ip, env.IP_SALT), now);
  return outcome === "not_found" ? fail(404, "not_found") : json(204, null);
}

export async function handleApi(req: Request, env: Env, now: number = Date.now()): Promise<Response> {
  const url = new URL(req.url);
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  try {
    if (url.pathname === "/api/guestbook") {
      if (req.method === "GET") return await list(url, env);
      if (req.method === "POST") return await create(req, env, ip, now);
      return fail(405, "bad_request", {}, { allow: "GET, POST" });
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
