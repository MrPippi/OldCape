export interface CapeEntry {
  readonly id: number;
  /** Colour bucket bitmask, bit order = COLOR_BUCKETS. */
  readonly colors: number;
  readonly blank: boolean;
  /** Global atlas position (sheet = pos / perSheet). */
  readonly pos: number;
}

export interface CapeIndex {
  readonly total: number;
  readonly perSheet: number;
  readonly cols: number;
  readonly cell: readonly [number, number];
  readonly capes: readonly CapeEntry[];
  /** Canonical ids and aliases, both mapped to the canonical entry. */
  readonly byId: ReadonlyMap<number, CapeEntry>;
}

export interface ColorBucket {
  readonly key: string;
  readonly label: string;
  readonly swatch: string;
}

export const COLOR_BUCKETS: readonly ColorBucket[] = [
  { key: "red", label: "紅", swatch: "#e53935" },
  { key: "orange", label: "橙", swatch: "#fb8c00" },
  { key: "yellow", label: "黃", swatch: "#fdd835" },
  { key: "green", label: "綠", swatch: "#43a047" },
  { key: "cyan", label: "青", swatch: "#00acc1" },
  { key: "blue", label: "藍", swatch: "#1e88e5" },
  { key: "purple", label: "紫", swatch: "#8e24aa" },
  { key: "pink", label: "粉", swatch: "#ec407a" },
  { key: "brown", label: "棕", swatch: "#795548" },
  { key: "white", label: "白", swatch: "#fafafa" },
  { key: "gray", label: "灰", swatch: "#9e9e9e" },
  { key: "black", label: "黑", swatch: "#212121" },
];
