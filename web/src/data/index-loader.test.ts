import { RAW_FIXTURE } from "./fixture";
import { INDEX_URL, loadIndex, parseIndex } from "./index-loader";
import { DATA_REV } from "./rev";

describe("parseIndex", () => {
  it("assigns atlas positions in array order", () => {
    const idx = parseIndex(structuredClone(RAW_FIXTURE));
    expect(idx.capes.map((c) => [c.id, c.pos])).toEqual([[3, 0], [7, 1], [12, 2]]);
    expect(idx.total).toBe(3);
    expect(idx.cell).toEqual([22, 17]);
  });

  it("maps aliases to the canonical entry", () => {
    const idx = parseIndex(structuredClone(RAW_FIXTURE));
    expect(idx.byId.get(20)).toBe(idx.byId.get(3));
  });

  it.each([
    ["empty object", {}],
    ["null", null],
    ["wrong version", { ...RAW_FIXTURE, v: 2 }],
    ["bad cape row", { ...RAW_FIXTURE, capes: [["x", 0, 0]] }],
    ["alias to unknown id", { ...RAW_FIXTURE, aliases: [[20, 999]] }],
  ])("rejects %s", (_name, json) => {
    expect(() => parseIndex(json)).toThrow("index: invalid");
  });
});

describe("loadIndex", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches and parses the index", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(RAW_FIXTURE))));
    const idx = await loadIndex("/data/index.json");
    expect(idx.total).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/data/index.json");
  });

  it("rejects on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(loadIndex()).rejects.toThrow("index: HTTP 500");
  });
});

describe("INDEX_URL", () => {
  it("carries the data revision so a cached index always matches its atlas sheets", () => {
    expect(INDEX_URL).toBe(`/data/index.json?r=${DATA_REV}`);
  });
});
