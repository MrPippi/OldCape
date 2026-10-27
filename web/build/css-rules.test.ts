// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/styles";
const sheets = readdirSync(DIR).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(join(DIR, f), "utf8")] as const);

describe("stylesheets", () => {
  it("never use pure black: shadows and scrims are tinted with the page's own dark (--shade)", () => {
    const pureBlack = /#000(?:0{3})?(?:[0-9a-f]{1,2})?\b|rgba?\(\s*0\s*,\s*0\s*,\s*0\b/i;
    const offenders = sheets.flatMap(([file, css]) =>
      css.split("\n").flatMap((line, i) => (pureBlack.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
