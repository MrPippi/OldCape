import { fixtureIndex } from "../data/fixture";
import type { CapeEntry } from "../data/types";
import { PAGE_SIZE, mountWall } from "./wall";

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
});
