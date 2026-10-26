import { fixtureIndex } from "../data/fixture";
import type { CapeEntry } from "../data/types";
import { HOLD_TO_FLIP_MS, PAGE_SIZE, STAGGER_CAP, mountWall } from "./wall";

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observers: Array<{ cb: IOCallback; targets: Element[]; disconnected: boolean }> = [];

class FakeObserver {
  private rec: { cb: IOCallback; targets: Element[]; disconnected: boolean };
  constructor(cb: IOCallback) {
    this.rec = { cb, targets: [], disconnected: false };
    observers.push(this.rec);
  }
  observe(el: Element) { this.rec.targets.push(el); }
  unobserve() {}
  disconnect() { this.rec.disconnected = true; }
}

const entries = (n: number): CapeEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: 100 + i, colors: 0, blank: false, pos: i }));

function trigger() {
  const live = observers.filter((o) => !o.disconnected);
  live[live.length - 1].cb([{ isIntersecting: true }]);
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe("mountWall", () => {
  it("pages through results as the sentinel comes into view", () => {
    const root = document.createElement("section");
    const wall = mountWall(root, fixtureIndex(), vi.fn());
    wall.setResults(entries(130));
    const cards = () => root.querySelectorAll(".card").length;
    expect(PAGE_SIZE).toBe(64);
    expect(cards()).toBe(64);
    trigger();
    expect(cards()).toBe(128);
    trigger();
    expect(cards()).toBe(130);
    expect(root.querySelector(".sentinel")).toBeNull();
  });

  it("labels each card with its id and opens it on click", () => {
    const root = document.createElement("section");
    const onOpen = vi.fn();
    const wall = mountWall(root, fixtureIndex(), onOpen);
    wall.setResults(entries(2));
    const first = root.querySelector<HTMLButtonElement>(".card")!;
    expect(first.querySelector(".num")?.textContent).toBe("#100");
    expect(first.querySelector(".cape")?.classList.contains("px")).toBe(true);
    first.click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
  });

  it("replaces previous results", () => {
    const root = document.createElement("section");
    const wall = mountWall(root, fixtureIndex(), vi.fn());
    wall.setResults(entries(70));
    wall.setResults(entries(3));
    expect(root.querySelectorAll(".card")).toHaveLength(3);
  });

  it("shows an empty state with a random fallback", () => {
    const root = document.createElement("section");
    const onOpen = vi.fn();
    const wall = mountWall(root, fixtureIndex(), onOpen);
    wall.setResults([]);
    expect(root.textContent).toContain("沒有符合的披風");
    const button = root.querySelector<HTMLButtonElement>(".empty button")!;
    expect(button.textContent).toContain("隨機看一件");
    button.click();
    expect(onOpen.mock.calls[0][0].blank).toBe(false);
  });

  it("puts the back face behind the front so a card can flip", () => {
    const root = document.createElement("section");
    const wall = mountWall(root, fixtureIndex(), vi.fn());
    wall.setResults(entries(1));
    const faces = root.querySelectorAll<HTMLElement>(".card .flip .cape");
    expect(faces).toHaveLength(2);
    expect(faces[1].classList.contains("back")).toBe(true);
    expect(faces[0].style.backgroundPosition).not.toBe(faces[1].style.backgroundPosition);
  });

  it("staggers each page's entrance from zero, capped so long pages do not drag", () => {
    const root = document.createElement("section");
    const wall = mountWall(root, fixtureIndex(), vi.fn());
    wall.setResults(entries(70));
    const order = () => [...root.querySelectorAll<HTMLElement>(".card")].map((c) => c.style.getPropertyValue("--i"));
    expect(order().slice(0, 3)).toEqual(["0", "1", "2"]);
    expect(order()[63]).toBe(String(STAGGER_CAP));
    trigger();
    expect(order()[64]).toBe("0");
  });

  describe("press and hold on touch", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const touch = (el: Element, type: string) =>
      el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: "touch" }));

    it("flips while held and does not open the cape on release", () => {
      const root = document.createElement("section");
      const onOpen = vi.fn();
      const wall = mountWall(root, fixtureIndex(), onOpen);
      wall.setResults(entries(1));
      const card = root.querySelector<HTMLButtonElement>(".card")!;
      touch(card, "pointerdown");
      vi.advanceTimersByTime(HOLD_TO_FLIP_MS);
      expect(card.classList.contains("is-flipped")).toBe(true);
      touch(card, "pointerup");
      card.click();
      expect(card.classList.contains("is-flipped")).toBe(false);
      expect(onOpen).not.toHaveBeenCalled();
      card.click();
      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("a quick tap still opens the cape", () => {
      const root = document.createElement("section");
      const onOpen = vi.fn();
      const wall = mountWall(root, fixtureIndex(), onOpen);
      wall.setResults(entries(1));
      const card = root.querySelector<HTMLButtonElement>(".card")!;
      touch(card, "pointerdown");
      vi.advanceTimersByTime(HOLD_TO_FLIP_MS - 50);
      touch(card, "pointerup");
      card.click();
      expect(card.classList.contains("is-flipped")).toBe(false);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });
});
