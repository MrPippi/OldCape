import { parseIndex } from "./index-loader";
import type { CapeIndex } from "./types";

const RED = 1 << 0;
const YELLOW = 1 << 2;

/** Raw index.json: ids 3, 7 (blank), 12; alias 20 → 3. */
export const RAW_FIXTURE = {
  v: 1,
  perSheet: 64,
  cols: 8,
  cell: [22, 17],
  total: 3,
  capes: [
    [3, RED | YELLOW, 0],
    [7, 0, 1],
    [12, RED, 0],
  ],
  aliases: [[20, 3]],
};

export function fixtureIndex(): CapeIndex {
  return parseIndex(structuredClone(RAW_FIXTURE));
}
