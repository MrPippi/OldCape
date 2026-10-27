const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric" });

/** "剛剛" / "N 分鐘前" / "N 小時前" / "N 天前", then a Taipei date like 2026/9/17. */
export function relativeTime(at: number, now: number): string {
  const ago = Math.max(0, now - at);
  if (ago < MIN) return "剛剛";
  if (ago < HOUR) return `${Math.floor(ago / MIN)} 分鐘前`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} 小時前`;
  if (ago < 30 * DAY) return `${Math.floor(ago / DAY)} 天前`;
  const part = (type: string): string => DATE.formatToParts(at).find((p) => p.type === type)?.value ?? "";
  return `${part("year")}/${Number(part("month"))}/${Number(part("day"))}`;
}
