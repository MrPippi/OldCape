import type { ChatRoom } from "./chat-room";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CHAT: DurableObjectNamespace<ChatRoom>;
  TURNSTILE_SECRET: string;
  IP_SALT: string;
  SESSION_KEY: string;
  /** Moderation; unset or shorter than 32 characters keeps the admin API off. */
  ADMIN_TOKEN?: string;
}
