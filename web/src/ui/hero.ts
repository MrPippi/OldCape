import { dailyPick, randomPick } from "../data/query";
import type { CapeEntry, CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import { formatCount, h } from "./dom";
import { heroScale } from "./scale";

export function mountHero(
  root: HTMLElement,
  index: CapeIndex,
  onOpen: (entry: CapeEntry) => void,
  today: Date = new Date(),
): void {
  const featured = dailyPick(index, today);

  const cape = h("span", { class: "cape", role: "img", "aria-label": `今日展出披風 #${featured.id}` });
  applySprite(cape, featured, index, "front", heroScale(window.innerWidth));
  const capeButton = h("button", { type: "button", class: "stage-cape", "aria-label": `查看披風 #${featured.id}` }, cape);
  capeButton.addEventListener("click", () => onOpen(featured));

  const randomButton = h("button", { type: "button", class: "b2", "data-action": "random" }, "🎲 隨機看一件");
  randomButton.addEventListener("click", () => onOpen(randomPick(index)));

  const findLink = h("a", { class: "b1", href: "#finder" }, "開始找我的披風");

  root.replaceChildren(
    h("div", { class: "hero-text" },
      h("div", { class: "kick" }, "台灣麥塊 · 玩家披風典藏"),
      h("h1", {}, "那些年，", h("br"), h("span", { class: "phrase" }, "我們披在"), h("span", { class: "phrase" }, "背上的回憶")),
      h("p", { class: "lead" }, "三萬件當年玩家親手畫的披風，全部還原成遊戲貼圖。找到你的那一件，下載，再穿上一次。"),
      h("dl", { class: "stats" },
        h("div", {}, h("dt", {}, "件披風"), h("dd", { class: "pixel", "data-stat": "total" }, formatCount(index.total))),
        h("div", {}, h("dt", {}, "遊戲貼圖"), h("dd", { class: "pixel" }, "64×32")),
        h("div", {}, h("dt", {}, "下載"), h("dd", {}, "免費"))),
      h("div", { class: "btns" }, findLink, randomButton)),
    h("div", { class: "stage" },
      capeButton,
      h("div", { class: "ped" }, "今日展出 · ", h("em", { class: "pixel" }, `#${featured.id}`))),
  );
}
