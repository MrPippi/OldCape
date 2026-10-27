import { findById } from "../data/query";
import type { CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import { capeHref } from "../router";
import { h } from "./dom";

/** Each linked cape pulls a cell of an atlas sheet; cap it so one message can't fan out. */
export const MAX_CAPE_REFS = 5;

// "#1234" standing alone: not glued to letters, digits or another '#'.
const CAPE_REF = /(?<![\w#])#(\d{1,6})(?![\w])/g;

/**
 * A guestbook message as DOM: text nodes, plus "#id" links (with a 1x mini cape)
 * for ids in the index. Never parses markup, so message text can't inject HTML.
 */
export function renderMessageBody(text: string, index: CapeIndex | null): DocumentFragment {
  const frag = document.createDocumentFragment();
  let last = 0;
  let linked = 0;
  for (const match of index ? text.matchAll(CAPE_REF) : []) {
    if (linked === MAX_CAPE_REFS) break;
    const entry = findById(index!, Number(match[1]));
    if (!entry) continue;
    const start = match.index;
    frag.append(text.slice(last, start));
    const mini = h("span", { class: "cape", "aria-hidden": "true" });
    applySprite(mini, entry, index!, "front", 1);
    frag.append(h("a", { class: "cape-ref", href: capeHref(entry.id), "data-id": entry.id }, mini, match[0]));
    last = start + match[0].length;
    linked++;
  }
  frag.append(text.slice(last));
  return frag;
}
