import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { checkRate, insertMessage } from "./store";
import { validateMessage } from "./validate";

const MAX_FRAME_CHARS = 4096;
const MAX_NONCE_CHARS = 40;

/** Who is on the other end of a socket; survives hibernation via serializeAttachment. */
interface Attachment {
  ipHash: string;
  canSpeak: boolean;
}

type Outgoing =
  | { type: "hello"; online: number; canSpeak: boolean }
  | { type: "online"; count: number }
  | { type: "message"; message: unknown; nonce?: string }
  | { type: "hidden"; id: number }
  | { type: "error"; code: string; retryAfter?: number; nonce?: string };

function parseSay(data: string | ArrayBuffer): { nickname: unknown; body: unknown; nonce?: string } | null {
  if (typeof data !== "string" || data.length > MAX_FRAME_CHARS) return null;
  try {
    const event = JSON.parse(data) as Record<string, unknown>;
    if (typeof event !== "object" || event === null || event.type !== "say") return null;
    const nonce = typeof event.nonce === "string" ? event.nonce.slice(0, MAX_NONCE_CHARS) : undefined;
    return { nickname: event.nickname, body: event.body, nonce };
  } catch {
    return null;
  }
}

/**
 * The one chat room. Uses the WebSocket Hibernation API, so an idle room costs nothing;
 * online count = open sockets. Messages are stored in D1 (the guestbook table).
 */
export class ChatRoom extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/online") return Response.json({ online: this.sockets().length });
    if (url.pathname === "/hidden" && req.method === "POST") {
      const { id } = await req.json<{ id: number }>();
      this.broadcast({ type: "hidden", id });
      return new Response(null, { status: 204 });
    }
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = {
      ipHash: req.headers.get("x-ip-hash") ?? "unknown",
      canSpeak: req.headers.get("x-can-speak") === "1",
    };
    server.serializeAttachment(attachment);
    const online = this.sockets().length;
    this.send(server, { type: "hello", online, canSpeak: attachment.canSpeak });
    this.broadcast({ type: "online", count: online }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const say = parseSay(data);
    if (!say) return this.send(ws, { type: "error", code: "bad_request" });
    const fail = (code: string, retryAfter?: number): void =>
      this.send(ws, { type: "error", code, ...(retryAfter === undefined ? {} : { retryAfter }), ...(say.nonce ? { nonce: say.nonce } : {}) });

    const { ipHash, canSpeak } = ws.deserializeAttachment() as Attachment;
    if (!canSpeak) return fail("need_session");
    const checked = validateMessage(say);
    if (!checked.ok) return fail(checked.error);
    const now = Date.now();
    try {
      const limited = await checkRate(this.env.DB, ipHash, now);
      if (limited) return fail(limited.error, limited.retryAfter);
      const message = await insertMessage(this.env.DB, { nickname: checked.nickname, body: checked.body, ipHash }, now);
      for (const socket of this.sockets()) {
        this.send(socket, socket === ws && say.nonce ? { type: "message", message, nonce: say.nonce } : { type: "message", message });
      }
    } catch (error) {
      console.error("chat: could not store a message", error);
      fail("server");
    }
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try {
      ws.close(code === 1005 ? 1000 : code, "bye");
    } catch {
      /* already closed */
    }
    this.broadcast({ type: "online", count: this.sockets(ws).length }, ws);
  }

  webSocketError(ws: WebSocket): void {
    this.webSocketClose(ws, 1011);
  }

  private sockets(except?: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets().filter((s) => s !== except && s.readyState === WebSocket.OPEN);
  }

  private send(ws: WebSocket, event: Outgoing): void {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      /* the socket went away mid-broadcast; its close handler updates the count */
    }
  }

  private broadcast(event: Outgoing, except?: WebSocket): void {
    for (const socket of this.sockets(except)) this.send(socket, event);
  }
}
