import type { CapeEntry, CapeIndex } from "./types";

const FULLWIDTH_ZERO = 0xff10;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Accepts "123", "#123", "# 123", "＃１２３" with surrounding spaces; anything else is null. */
export function parseIdInput(raw: string): number | null {
  const ascii = raw
    .trim()
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - FULLWIDTH_ZERO))
    .replace(/^[#＃]\s*/, "");
  return /^\d+$/.test(ascii) ? Number(ascii) : null;
}

export function findById(index: CapeIndex, id: number): CapeEntry | null {
  return index.byId.get(id) ?? null;
}

/** Non-blank capes containing every colour in `mask` (0 = all non-blank). */
export function filterByColors(index: CapeIndex, mask: number): CapeEntry[] {
  return index.capes.filter((c) => !c.blank && (c.colors & mask) === mask);
}

export function taipeiDateKey(date: Date): string {
  return new Date(date.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function nonBlank(index: CapeIndex): CapeEntry[] {
  const list = index.capes.filter((c) => !c.blank);
  if (list.length === 0) throw new Error("index: no displayable capes");
  return list;
}

/** Same cape for everyone on the same Taipei calendar day. */
export function dailyPick(index: CapeIndex, date: Date): CapeEntry {
  const list = nonBlank(index);
  return list[fnv1a(taipeiDateKey(date)) % list.length];
}

export function randomPick(index: CapeIndex, rand: () => number = Math.random): CapeEntry {
  const list = nonBlank(index);
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}
