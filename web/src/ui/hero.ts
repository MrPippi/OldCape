import { dailyPick, randomPick } from "../data/query";
import type { CapeEntry, CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import { formatCount } from "./dom";
import { heroScale } from "./scale";

function need<T extends Element>(root: HTMLElement, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`hero: markup missing (${selector})`);
  return node;
}

/** Fill the static hero in index.html with live stats and today's cape. */
export function mountHero(
  root: HTMLElement,
  index: CapeIndex,
  onOpen: (entry: CapeEntry) => void,
  today: Date = new Date(),
): void {
  const total = need<HTMLElement>(root, "[data-stat=total]");
  const capeButton = need<HTMLButtonElement>(root, ".stage-cape");
  const cape = need<HTMLElement>(root, ".stage-cape .cape");
  const featuredId = need<HTMLElement>(root, ".ped em");
  const randomButton = need<HTMLButtonElement>(root, "[data-action=random]");

  const featured = dailyPick(index, today);
  total.textContent = formatCount(index.total);
  featuredId.textContent = `#${featured.id}`;
  applySprite(cape, featured, index, "front", heroScale(window.innerWidth));
  cape.setAttribute("aria-label", `今日展出披風 #${featured.id}`);
  capeButton.setAttribute("aria-label", `查看披風 #${featured.id}`);
  capeButton.disabled = false;
  randomButton.disabled = false;

  capeButton.addEventListener("click", () => onOpen(featured));
  randomButton.addEventListener("click", () => onOpen(randomPick(index)));
}
