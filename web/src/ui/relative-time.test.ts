import { relativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 9, 27, 4, 0, 0); // 2026-10-27 12:00 Taipei
const ago = (ms: number) => relativeTime(NOW - ms, NOW);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it.each([
    [0, "剛剛"],
    [59_000, "剛剛"],
    [MIN, "1 分鐘前"],
    [59 * MIN, "59 分鐘前"],
    [HOUR, "1 小時前"],
    [23 * HOUR, "23 小時前"],
    [DAY, "1 天前"],
    [29 * DAY, "29 天前"],
  ])("%i ms ago reads %s", (ms, text) => {
    expect(ago(ms)).toBe(text);
  });

  it("shows a Taipei calendar date after 30 days", () => {
    expect(ago(40 * DAY)).toBe("2026/9/17");
  });

  it("treats a slightly future timestamp (clock skew) as just now", () => {
    expect(relativeTime(NOW + 5000, NOW)).toBe("剛剛");
  });
});
