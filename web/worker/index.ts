import { handleApi } from "./api";
import type { Env } from "./env";

export { ChatRoom } from "./chat-room";

/** /api/* is the guestbook; everything else is the static site (wrangler run_worker_first: ["/api/*"]). */
export default {
  fetch(req, env) {
    return new URL(req.url).pathname.startsWith("/api/") ? handleApi(req, env) : env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
