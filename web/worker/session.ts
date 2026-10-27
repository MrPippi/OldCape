/** A chat pass: proof that this visitor passed Turnstile recently. Stateless, HMAC-signed. */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export interface Session {
  sid: string;
  expiresAt: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array | null {
  if (!/^[\w-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const hmacKey = (key: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function issueSession(key: string, now: number): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + SESSION_TTL_MS;
  const sid = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = b64url(enc.encode(JSON.stringify({ sid, exp: expiresAt })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(key), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, expiresAt };
}

/** The pass if its signature checks out and it has not expired; otherwise null. */
export async function readSession(token: string, key: string, now: number): Promise<Session | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sigText] = parts;
  const sig = fromB64url(sigText);
  if (!sig || !fromB64url(payload)) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(key), sig, enc.encode(payload));
  if (!valid) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)!)) as { sid?: unknown; exp?: unknown };
    if (typeof data.sid !== "string" || typeof data.exp !== "number" || now >= data.exp) return null;
    return { sid: data.sid, expiresAt: data.exp };
  } catch {
    return null;
  }
}
