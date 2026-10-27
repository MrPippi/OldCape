// @vitest-environment node
import { SESSION_TTL_MS, issueSession, readSession } from "./session";

const KEY = "k".repeat(32);
const NOW = 1_800_000_000_000;

describe("chat session pass", () => {
  it("round-trips until it expires", async () => {
    const { token, expiresAt } = await issueSession(KEY, NOW);
    expect(expiresAt).toBe(NOW + SESSION_TTL_MS);
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(await readSession(token, KEY, NOW + 1000)).toMatchObject({ expiresAt });
    expect(await readSession(token, KEY, expiresAt)).toBeNull();
  });

  it("gives every pass its own id", async () => {
    const a = await readSession((await issueSession(KEY, NOW)).token, KEY, NOW);
    const b = await readSession((await issueSession(KEY, NOW)).token, KEY, NOW);
    expect(a!.sid).not.toBe(b!.sid);
  });

  it("rejects a pass signed with another key or altered", async () => {
    const { token } = await issueSession(KEY, NOW);
    expect(await readSession(token, "x".repeat(32), NOW)).toBeNull();
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sid: "x", exp: NOW + 10 * SESSION_TTL_MS })).toString("base64url");
    expect(await readSession(`${forged}.${sig}`, KEY, NOW)).toBeNull();
    expect(await readSession(`${payload}.${sig.slice(0, -2)}AA`, KEY, NOW)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", "!!!.???"])("rejects garbage %j", async (token) => {
    expect(await readSession(token, KEY, NOW)).toBeNull();
  });
});
