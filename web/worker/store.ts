export const PAGE_SIZE = 20;
export const REPORTS_TO_HIDE = 3;
export const MIN_GAP_MS = 30_000;
export const DAILY_LIMIT = 20;
const DAY_MS = 86_400_000;

export interface Message {
  id: number;
  nickname: string;
  body: string;
  createdAt: number;
}

export type RateLimited = { error: "too_fast" | "daily_limit"; retryAfter: number };

const toMessage = (r: { id: number; nickname: string; body: string; created_at: number }): Message => ({
  id: r.id,
  nickname: r.nickname,
  body: r.body,
  createdAt: r.created_at,
});

/** Visible messages, newest first; `before` is the id cursor from the previous page. */
export async function listMessages(db: D1Database, before: number | null): Promise<{ messages: Message[]; more: boolean }> {
  const { results } = await db
    .prepare(
      `SELECT id, nickname, body, created_at FROM messages
       WHERE hidden = 0 AND (?1 IS NULL OR id < ?1) ORDER BY id DESC LIMIT ?2`,
    )
    .bind(before, PAGE_SIZE + 1)
    .all<{ id: number; nickname: string; body: string; created_at: number }>();
  return { messages: results.slice(0, PAGE_SIZE).map(toMessage), more: results.length > PAGE_SIZE };
}

/** Null when the visitor may post now; otherwise which limit applies and seconds to wait. */
export async function checkRate(db: D1Database, ipHash: string, now: number): Promise<RateLimited | null> {
  const row = await db
    .prepare(`SELECT MAX(created_at) AS last, MIN(created_at) AS first, COUNT(*) AS n FROM messages WHERE ip_hash = ?1 AND created_at > ?2`)
    .bind(ipHash, now - DAY_MS)
    .first<{ last: number | null; first: number | null; n: number }>();
  if (!row || row.n === 0 || row.last === null || row.first === null) return null;
  const seconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));
  if (now - row.last < MIN_GAP_MS) return { error: "too_fast", retryAfter: seconds(row.last + MIN_GAP_MS - now) };
  if (row.n >= DAILY_LIMIT) return { error: "daily_limit", retryAfter: seconds(row.first + DAY_MS - now) };
  return null;
}

export async function insertMessage(
  db: D1Database,
  input: { nickname: string; body: string; ipHash: string },
  now: number,
): Promise<Message> {
  const row = await db
    .prepare(`INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4) RETURNING id, nickname, body, created_at`)
    .bind(input.nickname, input.body, now, input.ipHash)
    .first<{ id: number; nickname: string; body: string; created_at: number }>();
  if (!row) throw new Error("guestbook: insert returned no row");
  return toMessage(row);
}

/** Records one report per visitor; the third distinct report hides the message. */
export async function reportMessage(db: D1Database, id: number, ipHash: string, now: number): Promise<"ok" | "not_found"> {
  const exists = await db.prepare("SELECT 1 FROM messages WHERE id = ?1").bind(id).first();
  if (!exists) return "not_found";
  const added = await db
    .prepare("INSERT OR IGNORE INTO reports (message_id, ip_hash, created_at) VALUES (?1, ?2, ?3)")
    .bind(id, ipHash, now)
    .run();
  if (added.meta.changes > 0) {
    await db
      .prepare(
        `UPDATE messages SET report_count = report_count + 1,
           hidden = CASE WHEN report_count + 1 >= ?2 THEN 1 ELSE hidden END
         WHERE id = ?1`,
      )
      .bind(id, REPORTS_TO_HIDE)
      .run();
  }
  return "ok";
}
