/** Response and request helpers shared by the API routes. */
const MAX_REQUEST_BYTES = 4096;

export const json = (status: number, data: unknown, headers: Record<string, string> = {}): Response =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json(status, { error, ...extra }, headers);

export async function sourceHash(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** JSON-only bodies: a cross-site HTML form can't send application/json without a CORS preflight. */
export async function readJson(req: Request): Promise<{ data: Record<string, unknown> } | { res: Response }> {
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
