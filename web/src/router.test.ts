import { capeHref, pushCape, readCapeParam } from "./router";

describe("readCapeParam", () => {
  it("reads a numeric cape id", () => expect(readCapeParam("?cape=12")).toBe(12));
  it.each(["?cape=abc", "?cape=", "", "?other=1", "?cape=12abc"])("ignores %j", (s) => {
    expect(readCapeParam(s)).toBeNull();
  });
});

describe("capeHref / pushCape", () => {
  afterEach(() => history.replaceState(null, "", "/"));

  it("builds the share path", () => expect(capeHref(12)).toBe("/?cape=12"));

  it("pushes and clears the cape param", () => {
    pushCape(12);
    expect(location.search).toBe("?cape=12");
    pushCape(null);
    expect(location.pathname + location.search).toBe("/");
  });

  it("does not push a duplicate entry for the same cape", () => {
    pushCape(5);
    const len = history.length;
    pushCape(5);
    expect(history.length).toBe(len);
  });
});
