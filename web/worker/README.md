# Guestbook Worker

`/api/*` on oldcape.org runs `index.ts`; every other path is the static site in `dist/`.

- `GET  /api/guestbook?before=<id>`: 20 visible messages, newest first
- `POST /api/guestbook`: `{ nickname, body, token }` (Turnstile token) → 201
- `POST /api/guestbook/<id>/report`: `{}` → 204; 3 different visitors hide a message

Bindings: `DB` (D1 `oldcape-guestbook`), `ASSETS`. Secrets: `TURNSTILE_SECRET`, `IP_SALT`.
Tests: `npm run test:worker` (workerd + local D1).

## Moderation (no admin page yet)

Cloudflare dashboard → Storage & Databases → D1 → `oldcape-guestbook` → Console:

```sql
-- latest messages, including hidden ones
SELECT id, nickname, body, datetime(created_at / 1000, 'unixepoch', '+8 hours') AS taipei, hidden, report_count
FROM messages ORDER BY id DESC LIMIT 50;

-- hide one (reversible)
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
