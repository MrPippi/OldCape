import type { CapeEntry, CapeIndex } from "../data/types";

export type Face = "front" | "back";

/** Top-left of each face inside the 22x17 cape cell (Minecraft cape UV layout). */
export const FACE_OFFSET: Readonly<Record<Face, readonly [number, number]>> = {
  front: [1, 1],
  back: [12, 1],
};
export const FACE_SIZE = [10, 16] as const;
export const ATLAS_DIR = "/data/atlas";

export interface SpriteStyle {
  width: string;
  height: string;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
}

export function atlasUrl(sheet: number): string {
  return `${ATLAS_DIR}/atlas-${String(sheet).padStart(3, "0")}.png`;
}

/** Sheet number and pixel origin of an entry's 22x17 cell in its atlas. */
export function cellOrigin(entry: CapeEntry, index: CapeIndex): { sheet: number; x: number; y: number } {
  const sheet = Math.floor(entry.pos / index.perSheet);
  const slot = entry.pos % index.perSheet;
  return {
    sheet,
    x: (slot % index.cols) * index.cell[0],
    y: Math.floor(slot / index.cols) * index.cell[1],
  };
}

/** CSS for one cape face at an integer scale, cropped out of its atlas sheet. */
export function spriteStyle(entry: CapeEntry, index: CapeIndex, face: Face, scale: number): SpriteStyle {
  if (!Number.isInteger(scale) || scale <= 0) {
    throw new RangeError(`sprite: scale must be a positive integer, got ${scale}`);
  }
  const { sheet, x, y } = cellOrigin(entry, index);
  const [fx, fy] = FACE_OFFSET[face];
  const sheetW = index.cols * index.cell[0];
  const sheetH = (index.perSheet / index.cols) * index.cell[1];
  return {
    width: `${FACE_SIZE[0] * scale}px`,
    height: `${FACE_SIZE[1] * scale}px`,
    backgroundImage: `url("${atlasUrl(sheet)}")`,
    backgroundPosition: `${-(x + fx) * scale}px ${-(y + fy) * scale}px`,
    backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
  };
}

export function applySprite(el: HTMLElement, entry: CapeEntry, index: CapeIndex, face: Face, scale: number): void {
  el.classList.add("px");
  Object.assign(el.style, spriteStyle(entry, index, face, scale));
}
