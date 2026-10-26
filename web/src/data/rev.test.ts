import { DATA_REV, withRev } from "./rev";

describe("withRev", () => {
  it("tags a data URL with the build's data revision", () => {
    expect(withRev("/data/index.json", "0123abcdef")).toBe("/data/index.json?r=0123abcdef");
  });

  it("leaves the URL alone when no revision is known", () => {
    expect(withRev("/data/index.json", "")).toBe("/data/index.json");
  });

  it("defaults to the revision baked in at build time", () => {
    expect(DATA_REV).toMatch(/^[0-9a-f]{10}$/);
    expect(withRev("/x")).toBe(`/x?r=${DATA_REV}`);
  });
});
