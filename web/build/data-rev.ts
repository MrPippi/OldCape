import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Content hash of the cape data (index.json + every atlas sheet). It goes into the
 * data URLs as ?r=, so the files can be cached for a year: a rebuilt index can
 * never be paired with stale atlas sheets, which would misplace every cape.
 */
export function dataRevision(dataDir: string): string {
  const indexPath = join(dataDir, "index.json");
  if (!existsSync(indexPath)) throw new Error(`data-rev: ${indexPath} not found; build the cape data first`);
  const sheets = readdirSync(join(dataDir, "atlas")).filter((f) => f.endsWith(".png")).sort();
  const hash = createHash("sha256").update(readFileSync(indexPath));
  for (const sheet of sheets) hash.update(`\0${sheet}\0`).update(readFileSync(join(dataDir, "atlas", sheet)));
  return hash.digest("hex").slice(0, 10);
}
