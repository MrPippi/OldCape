import pageHtml from "../../index.html?raw";
import { fixtureIndex } from "../data/fixture";
import { dailyPick } from "../data/query";
import { mountHero } from "./hero";

/** The hero markup ships in index.html so text paints before data loads. */
function heroFromPage(): HTMLElement {
  const doc = new DOMParser().parseFromString(pageHtml, "text/html");
  const hero = doc.getElementById("hero");
  if (!hero) throw new Error("index.html has no #hero");
  const root = document.importNode(hero, true) as HTMLElement;
  document.body.replaceChildren(root);
  return root;
}

describe("mountHero", () => {
  const idx = fixtureIndex();
  const today = new Date("2026-10-26T12:00:00+08:00");

  it("ships the title in static HTML", () => {
    expect(heroFromPage().querySelector("h1")?.textContent).toBe("那些年，我們披在背上的回憶");
  });

  it("fills stats and today's cape from the index", () => {
    const root = heroFromPage();
    mountHero(root, idx, vi.fn(), today);
    expect(root.querySelector("[data-stat=total]")?.textContent).toBe("3");
    expect(root.querySelector(".ped em")?.textContent).toBe(`#${dailyPick(idx, today).id}`);
    expect(root.querySelector(".stage .cape")?.classList.contains("px")).toBe(true);
  });

  it("opens today's cape and a random cape", () => {
    const root = heroFromPage();
    const onOpen = vi.fn();
    mountHero(root, idx, onOpen, today);
    root.querySelector<HTMLButtonElement>(".stage button")?.click();
    expect(onOpen).toHaveBeenLastCalledWith(dailyPick(idx, today));
    root.querySelector<HTMLButtonElement>("[data-action=random]")?.click();
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[1][0].blank).toBe(false);
  });

  it("throws if the static markup is missing", () => {
    expect(() => mountHero(document.createElement("section"), idx, vi.fn(), today)).toThrow("hero: markup missing");
  });
});
