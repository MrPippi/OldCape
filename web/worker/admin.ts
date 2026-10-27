import { adminAuth } from "./admin-auth";
import type { Env } from "./env";
import { fail, json } from "./http";
import { roomFetch } from "./room";
import { deleteMessage, listAllMessages, setHidden } from "./store";

const CURSOR = /^\d{1,12}$/;

/** Tell every open chat to drop a message that moderation just took away. */
const unlist = (env: Env, id: number): Promise<Response> =>
  roomFetch(env, "/hidden", { method: "POST", body: JSON.stringify({ id }) });

/**
 * Moderation API behind ADMIN_TOKEN (a Worker secret, at least 32 characters).
 * GET messages[?before=], POST messages/:id/hide|show, DELETE messages/:id.
 */
export async function handleAdmin(req: Request, url: URL, env: Env): Promise<Response> {
  const auth = adminAuth(req.headers.get("authorization"), env.ADMIN_TOKEN);
  if (auth === "disabled") return fail(503, "admin_disabled");
  if (auth === "denied") return fail(401, "unauthorized", {}, { "www-authenticate": "Bearer" });

  const path = url.pathname.slice("/api/admin".length);
  if (path === "/messages") {
    if (req.method !== "GET") return fail(405, "bad_request", {}, { allow: "GET" });
    const before = url.searchParams.get("before");
    if (before !== null && !CURSOR.test(before)) return fail(400, "bad_request");
    return json(200, await listAllMessages(env.DB, before === null ? null : Number(before)));
  }

  const action = /^\/messages\/(\d{1,12})(?:\/(hide|show))?$/.exec(path);
  if (!action) return fail(404, "not_found");
  const id = Number(action[1]);
  const verb = action[2];
  if (verb) {
    if (req.method !== "POST") return fail(405, "bad_request", {}, { allow: "POST" });
    if (!(await setHidden(env.DB, id, verb === "hide"))) return fail(404, "not_found");
    if (verb === "hide") await unlist(env, id);
    return json(204, null);
  }
  if (req.method !== "DELETE") return fail(405, "bad_request", {}, { allow: "DELETE" });
  if (!(await deleteMessage(env.DB, id))) return fail(404, "not_found");
  await unlist(env, id);
  return json(204, null);
}
