export const BP_TABLET = 640;
export const BP_DESKTOP = 1024;

export type WallScale = 4 | 5 | 6;

/** Integer zoom for wall cards: responsiveness changes columns, never fractional scale. */
export function wallScale(viewportWidth: number): WallScale {
  if (viewportWidth >= BP_DESKTOP) return 6;
  if (viewportWidth >= BP_TABLET) return 5;
  return 4;
}

export function heroScale(viewportWidth: number): 6 | 14 {
  return viewportWidth >= BP_DESKTOP ? 14 : 6;
}

export function detailScale(viewportWidth: number): 6 | 12 {
  return viewportWidth >= BP_DESKTOP ? 12 : 6;
}

export const isDesktop = (viewportWidth: number): boolean => viewportWidth >= BP_DESKTOP;
