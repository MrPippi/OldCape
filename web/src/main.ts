import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/wall.css";
import "./styles/detail.css";

import { loadIndex } from "./data/index-loader";
import { filterByColors } from "./data/query";
import type { CapeEntry, CapeIndex } from "./data/types";
import { mountDetail } from "./ui/detail";
import { mountFinder } from "./ui/finder";
import { mountHero } from "./ui/hero";
import { showLoadError, showLoading } from "./ui/status";
import { mountWall } from "./ui/wall";

/** GitHub Releases asset with every 64x32 texture; set when the release exists. */
export const RELEASE_ZIP_URL = "";

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`layout: #${id} missing`);
  return node as T;
}

function mountPage(index: CapeIndex): void {
  const detail = mountDetail(byId("detail-root"), index);
  const open = (entry: CapeEntry): void => detail.open(entry);
  mountHero(byId("hero"), index, open);
  const wall = mountWall(byId("wall"), index, open);
  const showMatches = (mask: number): void => {
    const matches = filterByColors(index, mask);
    wall.setResults(matches);
    finder.setCount(matches.length);
  };
  const finder = mountFinder(byId("finder"), index, {
    onFilter: showMatches,
    onOpen: open,
    onNotFound: () => undefined,
  });
  showMatches(0);
  detail.syncFromLocation();
  window.addEventListener("popstate", () => detail.syncFromLocation());
}

function wireReleaseLink(): void {
  const link = byId<HTMLAnchorElement>("release-zip");
  if (RELEASE_ZIP_URL) link.href = RELEASE_ZIP_URL;
  else link.hidden = true;
}

async function boot(): Promise<void> {
  const wall = byId("wall");
  showLoading(wall);
  try {
    const index = await loadIndex();
    wall.replaceChildren();
    mountPage(index);
  } catch (error) {
    console.error("OldCape: failed to load cape index", error);
    showLoadError(wall, () => void boot());
  }
}

wireReleaseLink();
void boot();
