/** Shorter admin tokens are refused outright: the admin API stays off until a strong one is set. */
export const MIN_ADMIN_TOKEN = 32;

/** Compares every byte so the time taken says nothing about how much of a guess was right. */
function sameText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function adminAuth(header: string | null, configured: string | undefined): "ok" | "denied" | "disabled" {
  if (!configured || configured.length < MIN_ADMIN_TOKEN) return "disabled";
  const match = /^Bearer (.+)$/.exec(header ?? "");
  return match && sameText(match[1], configured) ? "ok" : "denied";
}
