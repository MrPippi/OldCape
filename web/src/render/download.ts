import type { CapeEntry, CapeIndex } from "../data/types";
import { atlasUrl, cellOrigin } from "./sprite";

export const TEXTURE_SIZE = [64, 32] as const;

export type ImageLoader = (url: string) => Promise<CanvasImageSource>;

export function textureFileName(id: number): string {
  return `oldcape-${id}.png`;
}

const loadAtlasImage: ImageLoader = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`download: cannot load ${url}`));
    img.src = url;
  });

/** Rebuild the in-game 64x32 texture: the 22x17 cape cell at (0,0), rest transparent. */
export async function renderTexture(
  entry: CapeEntry,
  index: CapeIndex,
  loadImage: ImageLoader = loadAtlasImage,
): Promise<Blob> {
  const { sheet, x, y } = cellOrigin(entry, index);
  const img = await loadImage(atlasUrl(sheet));
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE[0];
  canvas.height = TEXTURE_SIZE[1];
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("download: canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  const [w, h] = index.cell;
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("download: encode failed"))), "image/png"),
  );
}

export async function downloadCape(
  entry: CapeEntry,
  index: CapeIndex,
  loadImage: ImageLoader = loadAtlasImage,
): Promise<void> {
  const blob = await renderTexture(entry, index, loadImage);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = textureFileName(entry.id);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
