import type { CapeEntry, CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import type { Face } from "../render/sprite";
import { h } from "./dom";

/** Horizontal drag: degrees of spin per CSS pixel. */
export const DRAG_DEG_PER_PX = 0.6;
const TILT_DEG_PER_PX = 0.4;
export const MAX_TILT_DEG = 40;
/** Tilt baked into the idle spin (see slab-spin in detail.css). */
const SPIN_TILT_DEG = -10;

const FACES: readonly Face[] = ["front", "back", "left", "right", "top", "bottom"];
const VIEWS: ReadonlyArray<{ face: "front" | "back"; label: string; ry: number }> = [
  { face: "front", label: "外側", ry: 0 },
  { face: "back", label: "內側", ry: 180 },
];

export interface SlabApi {
  readonly el: HTMLElement;
}

const round = (deg: number): number => Math.round(deg * 100) / 100;

/** Current Y rotation of a spinning slab, read back from the running animation. */
function liveAngle(box: HTMLElement, fallback: number): number {
  const transform = getComputedStyle(box).transform;
  if (!transform || transform === "none" || typeof DOMMatrix === "undefined") return fallback;
  const m = new DOMMatrix(transform);
  return round((Math.atan2(m.m31, m.m11) * 180) / Math.PI);
}

/**
 * The cape as a 10x16x1 block. It spins slowly until touched; dragging turns it,
 * and the 外側/內側 buttons square a face to the viewer (crisp, on the z=0 plane).
 */
export function mountSlab(entry: CapeEntry, index: CapeIndex, scale: number): SlabApi {
  const box = h("div", { class: "slab spinning" },
    ...FACES.map((face) => {
      const el = h("span", { class: `sf ${face}` });
      applySprite(el, entry, index, face, scale);
      return el;
    }));
  box.style.setProperty("--d", `${scale}px`);

  let rx = SPIN_TILT_DEG;
  let ry = 0;
  let drag: { x: number; y: number; rx: number; ry: number } | null = null;

  const views = VIEWS.map(({ label }) => h("button", { type: "button", class: "b2", "aria-pressed": "false" }, label));
  const press = (active: number): void =>
    views.forEach((b, i) => b.setAttribute("aria-pressed", String(i === active)));

  const turn = (nextRx: number, nextRy: number): void => {
    rx = round(nextRx);
    ry = round(nextRy);
    box.classList.remove("spinning");
    box.style.setProperty("--rx", `${rx}deg`);
    box.style.setProperty("--ry", `${ry}deg`);
  };

  views.forEach((button, i) =>
    button.addEventListener("click", () => {
      turn(0, VIEWS[i].ry);
      press(i);
    }));

  const surface = h("div", { class: "slab-drag" }, h("div", { class: "slab-scene" }, box));
  surface.addEventListener("pointerdown", (event) => {
    const e = event as PointerEvent;
    const spinning = box.classList.contains("spinning");
    drag = { x: e.clientX, y: e.clientY, rx: spinning ? SPIN_TILT_DEG : rx, ry: spinning ? liveAngle(box, ry) : ry };
    box.classList.add("dragging");
    surface.setPointerCapture?.(e.pointerId);
  });
  surface.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const e = event as PointerEvent;
    const tilt = drag.rx - (e.clientY - drag.y) * TILT_DEG_PER_PX;
    turn(Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, tilt)), drag.ry + (e.clientX - drag.x) * DRAG_DEG_PER_PX);
    press(-1);
  });
  const end = (): void => {
    drag = null;
    box.classList.remove("dragging");
  };
  surface.addEventListener("pointerup", end);
  surface.addEventListener("pointercancel", end);

  const el = h("div", { class: "slab-stage", role: "group", "aria-label": `披風 #${entry.id} 3D 預覽` },
    surface,
    h("div", { class: "slab-views", role: "group", "aria-label": "看哪一面" }, ...views));
  return { el };
}
