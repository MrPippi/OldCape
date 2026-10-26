import { fixtureIndex } from "../data/fixture";
import { dailyPick } from "../data/query";
import { mountHero } from "./hero";

describe("mountHero", () => {
  const idx = fixtureIndex();
  const today = new Date("2026-10-26T12:00:00+08:00");

  it("shows stats from the index and today's cape", () => {
    const root = document.createElement("section");
    mountHero(root, idx, vi.fn(), today);
    expect(root.querySelector("[data-stat=total]")?.textContent).toBe("3");
    expect(root.querySelector(".ped em")?.textContent).toBe(`#${dailyPick(idx, today).id}`);
    expect(root.querySelector(".stage .cape")?.classList.contains("px")).toBe(true);
  });

  it("opens today's cape and a random cape", () => {
    const root = document.createElement("section");
    const onOpen = vi.fn();
    mountHero(root, idx, onOpen, today);
    root.querySelector<HTMLButtonElement>(".stage button")?.click();
    expect(onOpen).toHaveBeenLastCalledWith(dailyPick(idx, today));
    root.querySelector<HTMLButtonElement>("[data-action=random]")?.click();
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[1][0].blank).toBe(false);
  });
});
