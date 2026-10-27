import type { ChatEvent, ChatSocket, ConnState } from "../data/chat-socket";
import type { GuestMessage, GuestbookApi } from "../data/guestbook-api";
import type { CapeEntry, CapeIndex } from "../data/types";
import { chatItem } from "./chat-message";
import { h } from "./dom";
import { icon } from "./icons";
import type { Captcha } from "./turnstile";

const NICKNAME_KEY = "oldcape:nickname";
const PASS_KEY = "oldcape:chat-pass";
const REPORTED_KEY = "oldcape:reported";
const NICKNAME_MAX = 20;
const BODY_MAX = 300;
/** A pass this close to expiry is treated as gone, so a message never races the clock. */
const PASS_MARGIN_MS = 60_000;
const SEND_TIMEOUT_MS = 10_000;
const NEAR_BOTTOM_PX = 60;
const NEAR_TOP_PX = 40;
const GAP_FILL_PAGES = 5;

export interface ChatPanelDeps {
  api: GuestbookApi;
  connect: (handlers: { url: () => string; onEvent: (e: ChatEvent) => void; onState: (s: ConnState) => void }) => ChatSocket;
  captcha: (container: HTMLElement, onToken: (token: string) => void) => Promise<Captcha>;
  storage: Storage | null;
  now: () => number;
  wsUrl: (session: string | null) => string;
  openCape: (entry: CapeEntry) => void;
  onOnline?: (count: number) => void;
  onClose: () => void;
  nonce?: () => string;
}

export interface ChatPanel {
  /** First open: load history and connect. Safe to call again. */
  start(): void;
  setIndex(index: CapeIndex): void;
  focus(): void;
}

const SAY_ERRORS: Record<string, string> = {
  nickname_length: `暱稱需要 1–${NICKNAME_MAX} 個字`,
  body_length: `訊息需要 1–${BODY_MAX} 個字`,
  has_link: "訊息不能包含網址",
  blocked_word: "訊息包含不允許的字詞",
  daily_limit: "今天的發言次數已達上限，明天再來吧",
};

function read(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(storage: Storage | null, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    /* private mode: remembering is only a convenience */
  }
}
const chars = (s: string): number => [...s].length;

export function mountChatPanel(root: HTMLElement, deps: ChatPanelDeps): ChatPanel {
  const nonce = deps.nonce ?? (() => Math.random().toString(36).slice(2, 12));
  let index: CapeIndex | null = null;
  let messages: GuestMessage[] = [];
  const items = new Map<number, HTMLLIElement>();
  const reported = new Set<number>((read(deps.storage, REPORTED_KEY) ?? "").split(",").filter(Boolean).map(Number));
  let hasOlder = false;
  let loadingOlder = false;
  let started = false;
  let everOpen = false;
  let socket: ChatSocket | null = null;
  let canSpeak = false;
  let online = 0;
  let pending: { nickname: string; body: string; nonce: string } | null = null;
  let sending: ReturnType<typeof setTimeout> | null = null;
  let captcha: Captcha | null = null;
  let captchaLoading = false;

  // ---- pass (6-hour proof of a Turnstile check) ----
  const pass = (): string | null => {
    try {
      const p = JSON.parse(read(deps.storage, PASS_KEY) ?? "null") as { session?: unknown; expiresAt?: unknown } | null;
      return p && typeof p.session === "string" && typeof p.expiresAt === "number" && p.expiresAt - deps.now() > PASS_MARGIN_MS
        ? p.session
        : null;
    } catch {
      return null;
    }
  };

  // ---- DOM ----
  const state = h("span", { class: "chat-state", "aria-live": "polite" }, "連線中…");
  const closeBtn = h("button", { type: "button", class: "chat-close x", "aria-label": "關閉聊天室" }, icon("xmark"));
  closeBtn.addEventListener("click", () => deps.onClose());
  const list = h("ol", { class: "chat-list", "aria-label": "聊天訊息" });
  const historyStatus = h("div", { class: "chat-history", role: "status" });
  const log = h("div", { class: "chat-log", tabindex: 0 }, historyStatus, list);
  const newPill = h("button", { type: "button", class: "chat-new", hidden: true }, "有新訊息 ↓");
  const captchaBox = h("div", { class: "chat-captcha", hidden: true });
  const nickname = h("input", { name: "nickname", id: "chat-nickname", autocomplete: "nickname", placeholder: "暱稱", "aria-label": "暱稱" });
  nickname.value = read(deps.storage, NICKNAME_KEY) ?? "";
  const body = h("textarea", { name: "body", id: "chat-body", rows: 1, placeholder: "說點什麼…（Enter 送出）", "aria-label": "訊息" });
  const sendBtn = h("button", { type: "submit", class: "chat-send b1", "aria-label": "送出" }, "送出");
  const status = h("p", { class: "chat-status", role: "status" });
  const form = h("form", { class: "chat-form", novalidate: true },
    captchaBox,
    h("div", { class: "chat-inputs" }, nickname, body, sendBtn),
    status);

  root.replaceChildren(
    h("header", { class: "chat-head" }, h("h2", { id: "chat-title" }, "聊天室"), state, closeBtn),
    h("div", { class: "chat-scroll" }, log, newPill),
    form,
  );

  // ---- rendering ----
  const ctx = () => ({
    index,
    now: deps.now(),
    reported,
    report: (id: number) =>
      deps.api.report(id).then(() => {
        reported.add(id);
        write(deps.storage, REPORTED_KEY, [...reported].join(","));
      }),
  });
  const nearBottom = (): boolean => log.scrollHeight - log.scrollTop - log.clientHeight < NEAR_BOTTOM_PX;
  const toBottom = (): void => {
    log.scrollTop = log.scrollHeight;
    newPill.hidden = true;
  };
  const renderAll = (): void => {
    items.clear();
    list.replaceChildren(...messages.map((m) => {
      const li = chatItem(m, ctx());
      items.set(m.id, li);
      return li;
    }));
  };
  /** Insert in id order, skipping ones we already show. Returns how many were new. */
  const add = (incoming: readonly GuestMessage[]): number => {
    const fresh = incoming.filter((m) => !items.has(m.id));
    for (const m of [...fresh].sort((a, b) => a.id - b.id)) {
      const li = chatItem(m, ctx());
      const at = messages.findIndex((x) => x.id > m.id);
      if (at === -1) {
        messages.push(m);
        list.append(li);
      } else {
        list.insertBefore(li, items.get(messages[at].id)!);
        messages.splice(at, 0, m);
      }
      items.set(m.id, li);
    }
    return fresh.length;
  };

  list.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a.cape-ref");
    if (!link) return;
    event.preventDefault();
    const entry = index?.byId.get(Number(link.dataset.id));
    if (entry) deps.openCape(entry);
  });

  // ---- history ----
  const skeleton = (): HTMLElement =>
    h("div", { class: "chat-skeleton", role: "status", "aria-label": "載入訊息中" },
      ...[0, 1, 2, 3].map(() => h("div", { class: "ph-msg" }, h("span", { class: "ph-line short" }), h("span", { class: "ph-line" }))));

  const loadInitial = (): void => {
    historyStatus.replaceChildren(skeleton());
    deps.api
      .list({})
      .then((page) => {
        hasOlder = page.more;
        add(page.messages);
        historyStatus.replaceChildren(messages.length === 0 ? "還沒有人說話，來打聲招呼吧！" : "");
        toBottom();
      })
      .catch(() => {
        const retry = h("button", { type: "button", class: "b2" }, "重試");
        retry.addEventListener("click", loadInitial);
        historyStatus.replaceChildren("訊息載入失敗。", retry);
      });
  };
  const loadOlder = (): void => {
    if (!hasOlder || loadingOlder || messages.length === 0) return;
    loadingOlder = true;
    const before = log.scrollHeight;
    deps.api
      .list({ before: messages[0].id })
      .then((page) => {
        hasOlder = page.more;
        add(page.messages);
        log.scrollTop += log.scrollHeight - before; // keep the reader's place
      })
      .catch(() => undefined)
      .finally(() => {
        loadingOlder = false;
      });
  };
  const fillGap = async (): Promise<void> => {
    for (let page = 0; page < GAP_FILL_PAGES && messages.length > 0; page++) {
      const wasNear = nearBottom();
      const { messages: missed, more } = await deps.api.list({ after: messages[messages.length - 1].id });
      if (add(missed) > 0 && wasNear) toBottom();
      if (!more) return;
    }
  };
  log.addEventListener("scroll", () => {
    if (nearBottom()) newPill.hidden = true;
    if (log.scrollTop < NEAR_TOP_PX) loadOlder();
  });
  newPill.addEventListener("click", toBottom);

  // ---- sending ----
  const finishSend = (): void => {
    if (sending) clearTimeout(sending);
    sending = null;
    sendBtn.disabled = false;
  };
  const trySend = (): void => {
    if (!pending || sending) return;
    if (!socket?.send({ type: "say", ...pending })) {
      status.textContent = "連線中，請稍候…";
      return;
    }
    status.textContent = "";
    sendBtn.disabled = true;
    sending = setTimeout(() => {
      finishSend();
      pending = null;
      status.textContent = "送出逾時，請再試一次";
    }, SEND_TIMEOUT_MS);
  };
  const requestPass = (): void => {
    captchaBox.hidden = false;
    status.textContent = "完成下方驗證後就會送出";
    if (captcha) return captcha.reset();
    if (captchaLoading) return;
    captchaLoading = true;
    deps
      .captcha(captchaBox, (token) => {
        deps.api
          .session(token)
          .then(({ session, expiresAt }) => {
            write(deps.storage, PASS_KEY, JSON.stringify({ session, expiresAt }));
            captchaBox.hidden = true;
            status.textContent = "驗證完成，送出中…";
            socket?.reconnect(); // the new URL carries the pass; hello(canSpeak) sends the waiting message
          })
          .catch(() => {
            status.textContent = "驗證失敗，請再試一次";
            captcha?.reset();
          });
      })
      .then((c) => {
        captcha = c;
      })
      .catch((error: unknown) => {
        console.error("OldCape: turnstile failed to load", error);
        status.textContent = "驗證元件載入失敗，請重新整理頁面。";
      })
      .finally(() => {
        captchaLoading = false;
      });
  };

  const submit = (): void => {
    if (sending) return;
    const name = nickname.value.replace(/\s+/g, " ").trim();
    const text = body.value.trim();
    if (!name) return void (status.textContent = "請先輸入暱稱");
    if (chars(name) > NICKNAME_MAX) return void (status.textContent = SAY_ERRORS.nickname_length);
    if (!text) return void (status.textContent = "請輸入訊息");
    if (chars(text) > BODY_MAX) return void (status.textContent = SAY_ERRORS.body_length);
    pending = { nickname: name, body: text, nonce: nonce() };
    if (!pass()) return requestPass();
    if (!canSpeak) return void (status.textContent = "連線中，請稍候…");
    trySend();
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  body.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });

  // ---- socket events ----
  const showState = (s: ConnState): void => {
    state.textContent = s === "open" ? `${online} 人在線` : s === "connecting" ? "連線中…" : "重新連線中…";
  };
  const setOnline = (count: number): void => {
    online = count;
    state.textContent = `${count} 人在線`;
    deps.onOnline?.(count);
  };
  const onEvent = (e: ChatEvent): void => {
    switch (e.type) {
      case "hello":
        canSpeak = e.canSpeak;
        setOnline(e.online);
        if (pending && !sending) {
          if (canSpeak) trySend();
          else if (pass()) {
            write(deps.storage, PASS_KEY, null); // the server no longer accepts it
            requestPass();
          }
        }
        return;
      case "online":
        return setOnline(e.count);
      case "hidden":
        messages = messages.filter((m) => m.id !== e.id);
        items.get(e.id)?.remove();
        items.delete(e.id);
        return;
      case "message": {
        const mine = pending !== null && e.nonce === pending.nonce;
        const wasNear = nearBottom();
        add([e.message]);
        historyStatus.replaceChildren();
        if (mine) {
          write(deps.storage, NICKNAME_KEY, pending!.nickname);
          pending = null;
          finishSend();
          body.value = "";
          status.textContent = "";
        }
        if (mine || wasNear) toBottom();
        else newPill.hidden = false;
        return;
      }
      case "error":
        if (!pending || e.nonce !== pending.nonce) return;
        finishSend();
        if (e.code === "need_session") {
          write(deps.storage, PASS_KEY, null);
          canSpeak = false;
          return requestPass();
        }
        pending = null;
        status.textContent =
          e.code === "too_fast" ? `講太快了，請 ${e.retryAfter ?? 3} 秒後再試` : (SAY_ERRORS[e.code] ?? "送出失敗，請再試一次");
    }
  };
  const onState = (s: ConnState): void => {
    showState(s);
    if (s !== "open") canSpeak = false;
    if (s === "open") {
      if (everOpen) void fillGap().catch(() => undefined);
      everOpen = true;
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      loadInitial();
      socket = deps.connect({ url: () => deps.wsUrl(pass()), onEvent, onState });
    },
    setIndex(next) {
      index = next;
      renderAll();
    },
    focus() {
      // On touch screens focusing a text box pops the keyboard over half the chat; land on the log.
      if (window.matchMedia?.("(pointer: coarse)").matches) return log.focus({ preventScroll: true });
      (nickname.value ? body : nickname).focus();
    },
  };
}
