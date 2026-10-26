import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface RawIndex {
  total: number;
  capes: [number, number, number][];
  aliases: [number, number][];
}

export const INDEX: RawIndex = JSON.parse(
  readFileSync(fileURLToPath(new URL("../public/data/index.json", import.meta.url)), "utf-8"),
);

export const RED = 1 << 0;
export const nonBlank = INDEX.capes.filter((c) => c[2] === 0);
export const colorsOf = new Map(INDEX.capes.map((c) => [c[0], c[1]]));

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(buf: Buffer): [number, number] {
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
