import type { GuestMessage } from "./guestbook-api";

export type ChatEvent =
  | { type: "hello"; online: number; canSpeak: boolean }
  | { type: "online"; count: number }
  | { type: "message"; message: GuestMessage; nonce?: string }
  | { type: "hidden"; id: number }
  | { type: "error"; code: string; retryAfter?: number; nonce?: string };

export type ConnState = "connecting" | "open" | "reconnecting";

export const FIRST_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 15_000;

export interface ChatSocketDeps {
  /** Read on every (re)connect, so a newly earned chat pass is picked up. */
  url: () => string;
  onEvent: (event: ChatEvent) => void;
  onState: (state: ConnState) => void;
  WebSocketImpl?: typeof WebSocket;
}

export interface ChatSocket {
  /** False when not connected; the caller keeps the message and retries later. */
  send(event: { type: "say"; nickname: string; body: string; nonce: string }): boolean;
  /** Drop the current connection and open a new one now (e.g. with a new pass). */
  reconnect(): void;
  close(): void;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseEvent(raw: unknown): ChatEvent | null {
  if (typeof raw !== "string") return null;
  let e: unknown;
  try {
    e = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(e)) return null;
  switch (e.type) {
    case "hello":
      return isNum(e.online) && typeof e.canSpeak === "boolean" ? { type: "hello", online: e.online, canSpeak: e.canSpeak } : null;
    case "online":
      return isNum(e.count) ? { type: "online", count: e.count } : null;
    case "hidden":
      return isNum(e.id) ? { type: "hidden", id: e.id } : null;
    case "message": {
      const m = e.message;
      if (!isObj(m) || !isNum(m.id) || typeof m.nickname !== "string" || typeof m.body !== "string" || !isNum(m.createdAt)) return null;
      const message = { id: m.id, nickname: m.nickname, body: m.body, createdAt: m.createdAt };
      return typeof e.nonce === "string" ? { type: "message", message, nonce: e.nonce } : { type: "message", message };
    }
    case "error":
      if (typeof e.code !== "string") return null;
      return {
        type: "error",
        code: e.code,
        ...(isNum(e.retryAfter) ? { retryAfter: e.retryAfter } : {}),
        ...(typeof e.nonce === "string" ? { nonce: e.nonce } : {}),
      };
    default:
      return null;
  }
}

/** One live chat connection that reconnects by itself with capped exponential backoff. */
export function connectChat(deps: ChatSocketDeps): ChatSocket {
  const Impl = deps.WebSocketImpl ?? WebSocket;
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const open = (state: ConnState): void => {
    deps.onState(state);
    const socket = new Impl(deps.url());
    ws = socket;
    socket.addEventListener("open", () => {
      if (ws !== socket) return;
      attempt = 0;
      deps.onState("open");
    });
    socket.addEventListener("message", (m) => {
      if (ws !== socket) return;
      const event = parseEvent((m as MessageEvent).data);
      if (event) deps.onEvent(event);
    });
    socket.addEventListener("close", () => {
      if (ws !== socket || stopped) return; // replaced on purpose, or closed for good
      ws = null;
      deps.onState("reconnecting");
      const delay = Math.min(MAX_BACKOFF_MS, FIRST_BACKOFF_MS * 2 ** attempt);
      attempt++;
      timer = setTimeout(() => open("reconnecting"), delay);
    });
  };

  open("connecting");

  return {
    send(event) {
      if (!ws || ws.readyState !== 1) return false;
      ws.send(JSON.stringify(event));
      return true;
    },
    reconnect() {
      clearTimeout(timer);
      const old = ws;
      ws = null;
      old?.close(1000, "reconnect");
      attempt = 0;
      open("connecting");
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      ws?.close(1000, "bye");
      ws = null;
    },
  };
}
