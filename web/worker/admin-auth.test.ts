// @vitest-environment node
import { MIN_ADMIN_TOKEN, adminAuth } from "./admin-auth";

const GOOD = "a".repeat(MIN_ADMIN_TOKEN);

describe("adminAuth", () => {
  it("accepts the exact bearer token", () => {
    expect(adminAuth(`Bearer ${GOOD}`, GOOD)).toBe("ok");
  });

  it.each([null, "", "Bearer ", `Bearer ${GOOD}x`, `Bearer ${GOOD.slice(1)}`, GOOD, `Basic ${GOOD}`])("denies %j", (header) => {
    expect(adminAuth(header, GOOD)).toBe("denied");
  });

  it("stays off until a long enough token is configured", () => {
    expect(adminAuth(`Bearer ${GOOD}`, undefined)).toBe("disabled");
    expect(adminAuth("Bearer short", "short")).toBe("disabled");
    expect(MIN_ADMIN_TOKEN).toBe(32);
  });
});
