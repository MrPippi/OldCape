import type { GuestMessage } from "../data/guestbook-api";
import type { CapeIndex } from "../data/types";
import { h } from "./dom";
import { renderMessageBody } from "./linkify";
import { relativeTime } from "./relative-time";

const CONFIRM_RESET_MS = 4000;

export interface ItemContext {
  index: CapeIndex | null;
  now: number;
  reported: ReadonlySet<number>;
  /** Send the report; the caller remembers it. */
  report: (id: number) => Promise<void>;
}

/** Report needs a second click ("確定檢舉？"): the page can't use confirm(). */
function reportButton(id: number, ctx: ItemContext): HTMLButtonElement {
  const done = ctx.reported.has(id);
  const button = h(
    "button",
    { type: "button", class: "chat-report", "aria-label": "檢舉這則訊息", disabled: done },
    done ? "已檢舉" : "檢舉",
  );
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
    confirming = false;
    button.disabled = true;
    ctx
      .report(id)
      .then(() => {
        button.textContent = "已檢舉";
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = "檢舉失敗，再試一次";
      });
  });
  return button;
}

/** One chat line: name, time, body (text only, "#id" → cape link), report. */
export function chatItem(m: GuestMessage, ctx: ItemContext): HTMLLIElement {
  const when = new Date(m.createdAt);
  return h("li", { class: "chat-item", "data-id": m.id },
    h("header", {},
      h("b", { class: "chat-name" }, m.nickname),
      h("time", { datetime: when.toISOString(), title: when.toLocaleString("zh-TW") }, relativeTime(m.createdAt, ctx.now)),
      reportButton(m.id, ctx)),
    h("p", { class: "chat-body" }, renderMessageBody(m.body, ctx.index)));
}
