const SVG_NS = "http://www.w3.org/2000/svg";

/** Symbols in the <svg class="icon-sprite"> at the top of index.html (Font Awesome Free, CC BY 4.0). */
export const ICONS = ["dice", "download", "link", "check", "xmark", "comments"] as const;
export type IconName = (typeof ICONS)[number];

/** A decorative icon; the button or link around it carries the accessible name. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
