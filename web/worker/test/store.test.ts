import { env } from "cloudflare:test";
import { DAILY_LIMIT, MIN_GAP_MS, REPORTS_TO_HIDE, checkRate, insertMessage, listMessages, reportMessage } from "../store";

const DAY = 86_400_000;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM reports; DELETE FROM messages;");
});

describe("checkRate", () => {
  it("allows a first message and blocks the next within the gap", async () => {
    const now = 10 * DAY;
    expect(await checkRate(env.DB, "a", now)).toBeNull();
    await insertMessage(env.DB, { nickname: "n", body: "b", ipHash: "a" }, now);
    expect(MIN_GAP_MS).toBe(3000);
    expect(await checkRate(env.DB, "a", now + 1000)).toEqual({ error: "too_fast", retryAfter: 2 });
    expect(await checkRate(env.DB, "a", now + MIN_GAP_MS)).toBeNull();
    expect(await checkRate(env.DB, "b", now + 1000)).toBeNull();
  });

  it(`caps a visitor at ${DAILY_LIMIT} messages in any 24 hours`, async () => {
    expect(DAILY_LIMIT).toBe(200);
    const start = 10 * DAY;
    const insert = env.DB.prepare("INSERT INTO messages (nickname, body, created_at, ip_hash) VALUES ('n', 'b', ?, 'a')");
    await env.DB.batch(Array.from({ length: DAILY_LIMIT }, (_, i) => insert.bind(start + i * MIN_GAP_MS)));
    const later = start + DAILY_LIMIT * MIN_GAP_MS;
    const blocked = await checkRate(env.DB, "a", later);
    expect(blocked?.error).toBe("daily_limit");
    expect(blocked!.retryAfter).toBe(Math.ceil((start + DAY - later) / 1000));
    expect(await checkRate(env.DB, "a", start + DAY + 1)).toBeNull();
  });
});

describe("listMessages", () => {
  it("reads forward from an after= cursor, oldest first, for gap filling", async () => {
    for (let i = 1; i <= 5; i++) await insertMessage(env.DB, { nickname: "n", body: `b${i}`, ipHash: "a" }, i);
    const all = await listMessages(env.DB, { before: null, after: null });
    const third = all.messages[2].id; // newest first: 5, 4, 3, ...
    const after = await listMessages(env.DB, { before: null, after: third });
    expect(after.messages.map((m) => m.body)).toEqual(["b4", "b5"]);
    expect(after.more).toBe(false);
  });
});

describe("reportMessage", () => {
  it(`says when the ${REPORTS_TO_HIDE}th report hides the message`, async () => {
    const { id } = await insertMessage(env.DB, { nickname: "n", body: "b", ipHash: "a" }, 1);
    expect(await reportMessage(env.DB, id, "r1", 2)).toBe("ok");
    expect(await reportMessage(env.DB, id, "r2", 2)).toBe("ok");
    expect(await reportMessage(env.DB, id, "r3", 2)).toBe("hidden");
    expect(await reportMessage(env.DB, id, "r4", 2)).toBe("ok");
  });
});
