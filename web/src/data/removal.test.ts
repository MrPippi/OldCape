import { REMOVAL_TEMPLATE, removalRequestUrl } from "./removal";

describe("removalRequestUrl", () => {
  it("opens the GitHub removal form with the cape filled in", () => {
    const url = new URL(removalRequestUrl(1234));
    expect(url.origin + url.pathname).toBe("https://github.com/MrPippi/OldCape/issues/new");
    expect(url.searchParams.get("template")).toBe(REMOVAL_TEMPLATE);
    expect(url.searchParams.get("title")).toBe("移除披風 #1234");
    expect(url.searchParams.get("cape")).toBe("1234");
  });
});
