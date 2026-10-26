// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataRevision } from "./data-rev";

function dataDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "oldcape-rev-"));
  mkdirSync(join(dir, "atlas"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const base = { "index.json": '{"v":1}', "atlas/atlas-000.png": "A", "atlas/atlas-001.png": "B" };

describe("dataRevision", () => {
  it("is a short hex hash that is stable for the same files", () => {
    const rev = dataRevision(dataDir(base));
    expect(rev).toMatch(/^[0-9a-f]{10}$/);
    expect(dataRevision(dataDir(base))).toBe(rev);
  });

  it("changes when the index changes", () => {
    expect(dataRevision(dataDir({ ...base, "index.json": '{"v":2}' }))).not.toBe(dataRevision(dataDir(base)));
  });

  it("changes when any atlas sheet changes, is added, or is renamed", () => {
    const rev = dataRevision(dataDir(base));
    expect(dataRevision(dataDir({ ...base, "atlas/atlas-001.png": "C" }))).not.toBe(rev);
    expect(dataRevision(dataDir({ ...base, "atlas/atlas-002.png": "D" }))).not.toBe(rev);
    const { "atlas/atlas-001.png": moved, ...rest } = base;
    expect(dataRevision(dataDir({ ...rest, "atlas/atlas-009.png": moved }))).not.toBe(rev);
  });

  it("fails loudly when the data has not been built", () => {
    expect(() => dataRevision(join(tmpdir(), "oldcape-missing-data"))).toThrow(/index\.json/);
  });
});
