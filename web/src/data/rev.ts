/** Content hash of public/data, computed at build time by build/data-rev.ts. */
declare const __DATA_REV__: string;

export const DATA_REV: string = __DATA_REV__;

/** Version a data URL so it can be cached for a year without going stale. */
export function withRev(url: string, rev: string = DATA_REV): string {
  return rev ? `${url}?r=${rev}` : url;
}
