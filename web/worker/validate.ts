export const NICKNAME_MAX = 20;
export const BODY_MAX = 300;

export type ValidationError = "bad_request" | "nickname_length" | "body_length" | "has_link" | "blocked_word";
export type Validated = { ok: true; nickname: string; body: string } | { ok: false; error: ValidationError };

const LINK = new RegExp(
  [
    String.raw`https?:\/\/`,
    String.raw`www\.`,
    String.raw`discord\.gg`,
    String.raw`[a-z0-9-]+\.(?:com|net|org|tw|io|xyz|cc|me|gg|app|dev|top|info|shop|link|site|online|club|ly)\b`,
  ].join("|"),
  "i",
);

/** Spam and scam phrases seen on Taiwanese guestbooks. Extend as new spam shows up. */
const BLOCKED_WORDS = ["娛樂城", "博弈", "賭場", "百家樂", "代儲", "加賴", "加line", "援交", "約砲", "色情", "裸聊", "貸款"];

// Control characters except \n (tabs, NUL, bidi tricks are all dropped).
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

const length = (s: string): number => [...s].length;

function clean(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(CONTROL, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Normalise and check a guestbook submission. Pure; the Worker and its tests share it. */
export function validateMessage(input: { nickname: unknown; body: unknown }): Validated {
  if (typeof input.nickname !== "string" || typeof input.body !== "string") return { ok: false, error: "bad_request" };
  const nickname = clean(input.nickname.replace(/\n+/g, " "));
  const body = clean(input.body);
  if (length(nickname) < 1 || length(nickname) > NICKNAME_MAX) return { ok: false, error: "nickname_length" };
  if (length(body) < 1 || length(body) > BODY_MAX) return { ok: false, error: "body_length" };
  if (LINK.test(nickname) || LINK.test(body)) return { ok: false, error: "has_link" };
  const lower = `${nickname}\n${body}`.toLowerCase();
  if (BLOCKED_WORDS.some((word) => lower.includes(word))) return { ok: false, error: "blocked_word" };
  return { ok: true, nickname, body };
}
