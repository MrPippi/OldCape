import type { CapeEntry, CapeIndex } from "./types";
import { withRev } from "./rev";

export const INDEX_URL = withRev("/data/index.json");
const INDEX_VERSION = 1;

const invalid = (): Error => new Error("index: invalid");
const isInt = (n: unknown): n is number => Number.isInteger(n);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseCape(row: unknown, pos: number): CapeEntry {
  if (!Array.isArray(row) || row.length !== 3 || !row.every(isInt)) throw invalid();
  const [id, colors, blank] = row as number[];
  return { id, colors, blank: blank === 1, pos };
}

/** Validate the pipeline's index.json and build lookup tables. */
export function parseIndex(json: unknown): CapeIndex {
  if (!isRecord(json) || json.v !== INDEX_VERSION) throw invalid();
  const { perSheet, cols, cell, capes, aliases } = json;
  if (!isInt(perSheet) || !isInt(cols) || !Array.isArray(cell) || !cell.every(isInt)) {
    throw invalid();
  }
  if (!Array.isArray(capes) || !Array.isArray(aliases)) throw invalid();

  const entries = capes.map(parseCape);
  const byId = new Map<number, CapeEntry>(entries.map((e) => [e.id, e]));
  for (const pair of aliases) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(isInt)) throw invalid();
    const target = byId.get(pair[1]);
    if (!target) throw invalid();
    byId.set(pair[0], target);
  }
  return {
    total: entries.length,
    perSheet,
    cols,
    cell: [cell[0], cell[1]],
    capes: entries,
    byId,
  };
}

export async function loadIndex(url: string = INDEX_URL): Promise<CapeIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`index: HTTP ${res.status}`);
  return parseIndex(await res.json());
}
