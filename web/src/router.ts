const PARAM = "cape";

export function readCapeParam(search: string): number | null {
  const raw = new URLSearchParams(search).get(PARAM);
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
}

export function capeHref(id: number): string {
  return `/?${PARAM}=${id}`;
}

/** Reflect the open cape in the URL; null returns to the plain home URL. */
export function pushCape(id: number | null): void {
  if (readCapeParam(location.search) === id) return;
  const url = id === null ? location.pathname : capeHref(id);
  history.pushState({ cape: id }, "", url);
}
