import { detailScale, heroScale, wallScale } from "./scale";

describe("wallScale", () => {
  it.each([
    [320, 4],
    [375, 4],
    [639, 4],
    [640, 5],
    [1023, 5],
    [1024, 6],
    [1920, 6],
  ])("width %i → %ix", (w, s) => expect(wallScale(w)).toBe(s));
});

describe("heroScale", () => {
  it("is 6x below desktop and 14x from 1024px", () => {
    expect(heroScale(1023)).toBe(6);
    expect(heroScale(1024)).toBe(14);
  });
});

describe("detailScale", () => {
  it("is 6x in the mobile sheet and 12x in the desktop panel", () => {
    expect(detailScale(375)).toBe(6);
    expect(detailScale(1280)).toBe(12);
  });
});
