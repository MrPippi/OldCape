import { fixtureIndex } from "./fixture";
import {
  dailyPick,
  filterByColors,
  findById,
  parseIdInput,
  randomPick,
  taipeiDateKey,
} from "./query";

const RED = 1 << 0;
const YELLOW = 1 << 2;
const BLUE = 1 << 5;

describe("parseIdInput", () => {
  it.each([
    ["#123", 123],
    ["＃１２３", 123],
    [" 123 ", 123],
    ["123", 123],
    ["# 123", 123],
    ["＃ １２３", 123],
  ])("parses %j", (raw, id) => {
    expect(parseIdInput(raw)).toBe(id);
  });

  it.each(["abc", "", "12a", "#", "##12", "-5", "1.5"])("rejects %j", (raw) => {
    expect(parseIdInput(raw)).toBeNull();
  });
});

describe("findById", () => {
  const idx = fixtureIndex();
  it("resolves an alias to its canonical entry", () => {
    expect(findById(idx, 20)?.id).toBe(3);
  });
  it("finds blank capes", () => {
    expect(findById(idx, 7)?.blank).toBe(true);
  });
  it("returns null for unknown ids", () => {
    expect(findById(idx, 99)).toBeNull();
  });
});

describe("filterByColors", () => {
  const idx = fixtureIndex();
  const ids = (mask: number) => filterByColors(idx, mask).map((c) => c.id);
  it("mask 0 returns every non-blank cape", () => expect(ids(0)).toEqual([3, 12]));
  it("single colour", () => expect(ids(RED)).toEqual([3, 12]));
  it("multiple colours must all match", () => expect(ids(RED | YELLOW)).toEqual([3]));
  it("no match gives empty list", () => expect(ids(BLUE)).toEqual([]));
});

describe("dailyPick", () => {
  const idx = fixtureIndex();
  it("is stable within one Taipei day", () => {
    const a = dailyPick(idx, new Date("2026-10-26T00:30:00+08:00"));
    const b = dailyPick(idx, new Date("2026-10-26T23:30:00+08:00"));
    expect(a.id).toBe(b.id);
  });
  it("uses the Taipei date, not UTC", () => {
    // 2026-10-26 00:30 Taipei is still 2026-10-25 in UTC
    const taipeiMorning = dailyPick(idx, new Date("2026-10-25T16:30:00Z"));
    const taipeiNight = dailyPick(idx, new Date("2026-10-26T15:30:00Z"));
    expect(taipeiMorning.id).toBe(taipeiNight.id);
  });
  it("never picks a blank cape", () => {
    for (let d = 1; d <= 28; d++) {
      const date = new Date(`2026-02-${String(d).padStart(2, "0")}T12:00:00+08:00`);
      expect(dailyPick(idx, date).blank).toBe(false);
    }
  });
});

describe("randomPick", () => {
  const idx = fixtureIndex();
  it("returns non-blank entries across the range", () => {
    expect(randomPick(idx, () => 0).id).toBe(3);
    expect(randomPick(idx, () => 0.99).id).toBe(12);
  });
});

describe("taipeiDateKey", () => {
  it("formats the UTC+8 calendar date", () => {
    expect(taipeiDateKey(new Date("2026-10-25T16:30:00Z"))).toBe("2026-10-26");
    expect(taipeiDateKey(new Date("2026-10-25T15:59:59Z"))).toBe("2026-10-25");
    expect(taipeiDateKey(new Date("2026-01-05T00:00:00+08:00"))).toBe("2026-01-05");
  });
});
