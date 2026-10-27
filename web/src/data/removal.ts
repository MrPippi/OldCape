const REPO = "https://github.com/MrPippi/OldCape";
/** .github/ISSUE_TEMPLATE/cape-removal.yml; its "cape" field is prefilled from the URL. */
export const REMOVAL_TEMPLATE = "cape-removal.yml";

/** GitHub issue form asking to remove one cape (its author changed their mind). */
export function removalRequestUrl(id: number): string {
  const params = new URLSearchParams({ template: REMOVAL_TEMPLATE, title: `移除披風 #${id}`, cape: String(id) });
  return `${REPO}/issues/new?${params}`;
}
