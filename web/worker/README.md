# Chat Worker

`/api/*` on oldcape.org runs `index.ts`; every other path is the static site in `dist/`.

- `GET  /api/chat` (WebSocket): the one chat room, a hibernating Durable Object (`chat-room.ts`).
  Anyone can read; `?session=<pass>` lets the socket speak. Events: `hello`, `online`, `message`, `hidden`, `error`.
- `POST /api/chat/session`: `{ token }` (Turnstile) → `{ session, expiresAt }`, a 6-hour HMAC pass
- `GET  /api/chat/online`: `{ online }`
- `GET  /api/guestbook?before=<id>` / `?after=<id>`: history, 20 per page (the table is still called messages)
- `POST /api/guestbook/<id>/report`: `{}` → 204; 3 different visitors hide a message (broadcast as `hidden`)

Limits: 1 message / 3 s and 200 / day per source (salted IP hash; raw IPs are never stored).
Bindings: `DB` (D1 `oldcape-guestbook`), `CHAT` (Durable Object `ChatRoom`), `ASSETS`.
Secrets: `TURNSTILE_SECRET`, `IP_SALT`, `SESSION_KEY`.
Tests: `npm run test:worker` (workerd + local D1 + real WebSockets).

## Moderation (no admin page yet)

Cloudflare dashboard → Storage & Databases → D1 → `oldcape-guestbook` → Console:

```sql
-- latest messages, including hidden ones
SELECT id, nickname, body, datetime(created_at / 1000, 'unixepoch', '+8 hours') AS taipei, hidden, report_count
FROM messages ORDER BY id DESC LIMIT 50;

-- hide one (reversible; open chats drop it on their next reload)
UPDATE messages SET hidden = 1 WHERE id = 123;

-- show a message that reports hid by mistake
UPDATE messages SET hidden = 0, report_count = 0 WHERE id = 123;
DELETE FROM reports WHERE message_id = 123;

-- delete for good
DELETE FROM messages WHERE id = 123;

-- hide everything one source posted (spam wave)
UPDATE messages SET hidden = 1 WHERE ip_hash = (SELECT ip_hash FROM messages WHERE id = 123);
```

## Schema changes

Add `migrations/000N_*.sql`, then `npx wrangler d1 migrations apply oldcape-guestbook --remote`.
