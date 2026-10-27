import { env } from "cloudflare:test";
import { DAILY_LIMIT, MIN_GAP_MS, checkRate, insertMessage } from "../store";

const DAY = 86_400_000;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM reports; DELETE FROM messages;");
});

describe("checkRate", () => {
  it("allows a first message and blocks the next within the gap", async () => {
    const now = 10 * DAY;
    expect(await checkRate(env.DB, "a", now)).toBeNull();
    await insertMessage(env.DB, { nickname: "n", body: "b", ipHash: "a" }, now);
    expect(await checkRate(env.DB, "a", now + 1000)).toEqual({ error: "too_fast", retryAfter: 29 });
    expect(await checkRate(env.DB, "a", now + MIN_GAP_MS)).toBeNull();
    expect(await checkRate(env.DB, "b", now + 1000)).toBeNull();
  });

  it(`caps a visitor at ${DAILY_LIMIT} messages in any 24 hours`, async () => {
    const start = 10 * DAY;
    for (let i = 0; i < DAILY_LIMIT; i++) {
      await insertMessage(env.DB, { nickname: "n", body: `b${i}`, ipHash: "a" }, start + i * MIN_GAP_MS);
    }
    const later = start + DAILY_LIMIT * MIN_GAP_MS;
    const blocked = await checkRate(env.DB, "a", later);
    expect(blocked?.error).toBe("daily_limit");
    expect(blocked!.retryAfter).toBe(Math.ceil((start + DAY - later) / 1000));
    expect(await checkRate(env.DB, "a", start + DAY + 1)).toBeNull();
  });
});
