# 老披風留言板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A site-wide guestbook dialog backed by the existing Worker + D1, with Turnstile, rate limits, report-to-hide, and `#1234` links with a mini cape.

**Architecture:** The Worker gains code: `/api/*` runs `web/worker/index.ts` (`run_worker_first`), everything else falls through to static assets. Pure logic (validation, linkify) is unit-tested; the D1 store and HTTP handlers are tested in the Workers runtime with `@cloudflare/vitest-pool-workers`. The frontend dialog loads data and Turnstile only on first open.

**Tech Stack:** Cloudflare Workers + D1 + Turnstile, TypeScript, Vitest (jsdom + workers pool), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-guestbook-design.md`

## Global Constraints

- Nickname 1–20 code points, body 1–300 code points, after trim.
- Rate limit per source: 1 message / 30 s, 20 / day. Source = SHA-256(IP_SALT + CF-Connecting-IP), first 32 hex; raw IP never stored.
- Reject bodies or nicknames containing links (`http(s)://`, `www.`, common TLDs, `discord.gg`) or blocked words.
- 3 distinct reports hide a message.
- Page size 20, newest first, cursor `before=<id>`.
- `#1234` → link with a 1x front-face sprite, at most 5 per message; unknown ids stay text; aliases resolve.
- Everything rendered as text nodes (no innerHTML).
- First page load unchanged: no guestbook fetch or Turnstile script until the dialog opens.
- Error codes from the API (`nickname_length`, `body_length`, `has_link`, `blocked_word`, `captcha`, `too_fast`, `daily_limit`, `not_found`, `bad_request`) map to Chinese copy in the client.

## Review Focus

- A message posted from a page that has no Turnstile token yet → client blocks submit with 「請先完成驗證」.
- The same visitor reporting twice → counted once.
- Cross-site form POST to the API → rejected (JSON content type required).
- Deep link `/#guestbook` before the cape index loads → messages show, `#1234` links appear once the index is ready (re-render).
- D1 or Turnstile outage → user sees a retryable error, never a blank dialog.

---

### Task 1: Validation + linkify (pure)

**Files:** Create `web/worker/validate.ts` + test; `web/src/ui/linkify.ts` + test.

- `validateMessage({nickname, body}) → {ok: true, nickname, body} | {ok: false, error}`: trims, strips control chars except `\n`, collapses 3+ newlines to 2, length checks, link + word filter.
- `capeRefs(text, max = 5) → Array<{start, end, id}>` and `renderMessageBody(text, resolve) → DocumentFragment` where `resolve(id)` returns a `CapeEntry | null`.

### Task 2: D1 store + HTTP handlers (workers pool)

**Files:** `web/worker/migrations/0001_init.sql`, `web/worker/store.ts`, `web/worker/turnstile.ts`, `web/worker/api.ts`, `web/worker/index.ts`, `web/worker/vitest.config.ts`, tests under `web/worker/test/`.

- `GET /api/guestbook?before=` → `{messages:[{id,nickname,body,createdAt}], more}`.
- `POST /api/guestbook` (JSON: nickname, body, token) → 201 `{message}`; 400/403/429 `{error}` with `retryAfter` on 429.
- `POST /api/guestbook/:id/report` → 204; 404 unknown.
- Non-JSON POST → 415 `bad_request`. Unknown `/api/*` → 404.
- Turnstile verified against `https://challenges.cloudflare.com/turnstile/v0/siteverify` (mocked in tests).

### Task 3: Worker config

**Files:** `web/wrangler.jsonc` (`main`, `assets.binding`, `run_worker_first: ["/api/*"]`, `d1_databases`), `web/tsconfig.worker.json`.

### Task 4: Guestbook dialog (frontend)

**Files:** `web/src/ui/guestbook.ts` + test, `web/src/ui/info.ts` (`onDialogOpen`), `web/index.html`, `web/src/styles/guestbook.css`, `web/src/main.ts`, `web/e2e/guestbook.spec.ts`.

- First open: fetch page 1, inject Turnstile script (explicit render). Load more, submit, report (remembered in localStorage), nickname remembered, relative time.
- Cape links close the dialog and open the cape detail.

### Task 5: Cloud resources + deploy

- Create D1 `oldcape-guestbook`, apply `0001_init.sql`, create Turnstile widget for `oldcape.org`, set secrets `TURNSTILE_SECRET`, `IP_SALT`, push, live smoke test (post + report + delete a test message), document SQL in `web/worker/README.md`.
