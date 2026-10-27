import { ApiError } from "../data/guestbook-api";
import type { GuestMessage, GuestbookApi } from "../data/guestbook-api";
import type { CapeEntry, CapeIndex } from "../data/types";
import { h } from "./dom";
import { renderMessageBody } from "./linkify";
import { relativeTime } from "./relative-time";

const NICKNAME_KEY = "oldcape:nickname";
const REPORTED_KEY = "oldcape:reported";
const NICKNAME_MAX = 20;
const BODY_MAX = 300;
const CONFIRM_RESET_MS = 4000;

/** A rendered Turnstile widget: the current token (single use) and a way to get a fresh one. */
export interface Captcha {
  token(): string | null;
  reset(): void;
}

export interface GuestbookDeps {
  api: GuestbookApi;
  captcha: (container: HTMLElement) => Promise<Captcha>;
  storage: Storage | null;
  now: () => number;
  openCape: (entry: CapeEntry) => void;
}

export interface GuestbookView {
  /** First open of the dialog: fetch messages and render the human check. Safe to call again. */
  load(): void;
  /** The cape index arrived: re-render so "#1234" becomes a cape link. */
  setIndex(index: CapeIndex): void;
}

const POST_ERRORS: Record<string, string> = {
  nickname_length: `暱稱需要 1–${NICKNAME_MAX} 個字`,
  body_length: `留言需要 1–${BODY_MAX} 個字`,
  has_link: "留言不能包含網址",
  blocked_word: "留言包含不允許的字詞",
  captcha: "驗證失敗，請重新驗證",
  daily_limit: "今天的留言次數已達上限，明天再來吧",
};

function postErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "too_fast") return `留言太頻繁，請 ${error.retryAfter ?? 30} 秒後再試`;
    if (error.code in POST_ERRORS) return POST_ERRORS[error.code];
  }
  return "送出失敗，請稍後再試";
}

function read(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* private mode or full: remembering is only a convenience */
  }
}

const chars = (s: string): number => [...s].length;

export function mountGuestbook(root: HTMLElement, deps: GuestbookDeps): GuestbookView {
  let index: CapeIndex | null = null;
  let messages: readonly GuestMessage[] = [];
  let hasMore = false;
  let loaded = false;
  let captcha: Captcha | null = null;
  const reported = new Set<number>(
    (read(deps.storage, REPORTED_KEY) ?? "").split(",").filter(Boolean).map(Number),
  );

  const nickname = h("input", { name: "nickname", id: "gb-nickname", autocomplete: "nickname", maxlength: NICKNAME_MAX * 2 });
  nickname.value = read(deps.storage, NICKNAME_KEY) ?? "";
  const body = h("textarea", { name: "body", id: "gb-body", rows: 3, placeholder: "例如：#1234 是我當年的披風！" });
  const count = h("span", { class: "gb-count", "aria-live": "polite" }, `0/${BODY_MAX}`);
  const updateCount = (): void => {
    count.textContent = `${chars(body.value)}/${BODY_MAX}`;
  };
  body.addEventListener("input", updateCount);
  const captchaBox = h("div", { class: "gb-captcha" });
  const send = h("button", { type: "submit", class: "b1" }, "送出");
  const status = h("p", { class: "gb-status", role: "status" });
  const form = h("form", { class: "gb-form", novalidate: true },
    h("label", { for: "gb-nickname" }, "暱稱"), nickname,
    h("label", { for: "gb-body" }, "留言"), body,
    h("div", { class: "gb-row" }, captchaBox, count),
    h("div", { class: "gb-row" }, send, status));

  const list = h("ol", { class: "gb-list", "aria-label": "留言列表" });
  const listStatus = h("div", { class: "gb-list-status", role: "status" });
  const more = h("button", { type: "button", class: "b2 gb-more", hidden: true }, "載入更多");

  const reportButton = (id: number): HTMLButtonElement => {
    const done = reported.has(id);
    const button = h("button", { type: "button", class: "gb-report", disabled: done }, done ? "已檢舉" : "檢舉");
    let confirming = false;
    button.addEventListener("click", () => {
      if (!confirming) {
        confirming = true;
        button.textContent = "確定檢舉？";
        setTimeout(() => {
          if (confirming && !button.disabled) {
            confirming = false;
            button.textContent = "檢舉";
          }
        }, CONFIRM_RESET_MS);
        return;
      }
      button.disabled = true;
      deps.api
        .report(id)
        .then(() => {
          reported.add(id);
          write(deps.storage, REPORTED_KEY, [...reported].join(","));
          button.textContent = "已檢舉";
        })
        .catch(() => {
          confirming = false;
          button.disabled = false;
          button.textContent = "檢舉失敗，再試一次";
        });
    });
    return button;
  };

  const item = (m: GuestMessage): HTMLLIElement => {
    const when = new Date(m.createdAt);
    return h("li", { class: "gb-item", "data-id": m.id },
      h("header", {},
        h("b", { class: "gb-name" }, m.nickname),
        h("time", { datetime: when.toISOString(), title: when.toLocaleString("zh-TW") }, relativeTime(m.createdAt, deps.now()))),
      h("p", { class: "gb-body" }, renderMessageBody(m.body, index)),
      reportButton(m.id));
  };

  const render = (): void => {
    list.replaceChildren(...messages.map(item));
    more.hidden = !hasMore;
  };

  list.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a.cape-ref");
    if (!link) return;
    event.preventDefault();
    const entry = index?.byId.get(Number(link.dataset.id));
    if (entry) deps.openCape(entry);
  });

  const fetchPage = (before: number | null): void => {
    listStatus.replaceChildren();
    more.disabled = true;
    deps.api
      .list(before)
      .then((page) => {
        messages = before === null ? page.messages : [...messages, ...page.messages];
        hasMore = page.more;
        render();
        if (messages.length === 0) listStatus.textContent = "還沒有留言，來當第一個吧！";
      })
      .catch(() => {
        const retry = h("button", { type: "button", class: "b2" }, "重試");
        retry.addEventListener("click", () => fetchPage(before));
        listStatus.replaceChildren("留言載入失敗。", retry);
      })
      .finally(() => {
        more.disabled = false;
      });
  };
  more.addEventListener("click", () => fetchPage(messages.at(-1)?.id ?? null));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nickname.value.replace(/\s+/g, " ").trim();
    const text = body.value.trim();
    if (!name) return void (status.textContent = "請輸入暱稱");
    if (chars(name) > NICKNAME_MAX) return void (status.textContent = POST_ERRORS.nickname_length);
    if (!text) return void (status.textContent = "請輸入留言");
    if (chars(text) > BODY_MAX) return void (status.textContent = POST_ERRORS.body_length);
    const token = captcha?.token() ?? null;
    if (!token) return void (status.textContent = "請先完成驗證");

    send.disabled = true;
    send.textContent = "送出中…";
    status.textContent = "";
    deps.api
      .post({ nickname: name, body: text, token })
      .then((saved) => {
        messages = [saved, ...messages];
        render();
        listStatus.replaceChildren();
        body.value = "";
        updateCount();
        write(deps.storage, NICKNAME_KEY, name);
        status.textContent = "已送出，謝謝你的留言！";
      })
      .catch((error: unknown) => {
        status.textContent = postErrorText(error);
      })
      .finally(() => {
        captcha?.reset(); // tokens are single use
        send.disabled = false;
        send.textContent = "送出";
      });
  });

  root.replaceChildren(form, list, listStatus, more);

  return {
    load() {
      if (loaded) return;
      loaded = true;
      fetchPage(null);
      deps
        .captcha(captchaBox)
        .then((c) => {
          captcha = c;
        })
        .catch((error: unknown) => {
          console.error("OldCape: turnstile failed to load", error);
          status.textContent = "驗證元件載入失敗，請重新整理頁面。";
        });
    },
    setIndex(next) {
      index = next;
      render();
    },
  };
}
