import { BODY_MAX, NICKNAME_MAX, validateMessage } from "./validate";

const ok = (nickname: string, body: string) => validateMessage({ nickname, body });

describe("validateMessage", () => {
  it("accepts a normal message and trims it", () => {
    expect(ok("  阿明 ", "  #1234 是我的披風！\n好懷念 ")).toEqual({ ok: true, nickname: "阿明", body: "#1234 是我的披風！\n好懷念" });
  });

  it("counts length in characters, not UTF-16 units", () => {
    expect(ok("😀".repeat(NICKNAME_MAX), "嗨")).toMatchObject({ ok: true });
    expect(ok("a", "字".repeat(BODY_MAX))).toMatchObject({ ok: true });
  });

  it.each([
    ["", "內容", "nickname_length"],
    ["   ", "內容", "nickname_length"],
    ["a".repeat(NICKNAME_MAX + 1), "內容", "nickname_length"],
    ["阿明", "", "body_length"],
    ["阿明", " \n ", "body_length"],
    ["阿明", "字".repeat(BODY_MAX + 1), "body_length"],
  ])("rejects bad lengths: %j / %j", (nickname, body, error) => {
    expect(ok(nickname, body)).toEqual({ ok: false, error });
  });

  it.each([
    "看這裡 https://spam.example",
    "http://x.y",
    "去 www.example 看看",
    "加我 example.com",
    "discord.gg/abcd",
    "官網 EXAMPLE.TW",
  ])("rejects links: %j", (body) => {
    expect(ok("阿明", body)).toEqual({ ok: false, error: "has_link" });
  });

  it("rejects links hidden in the nickname too", () => {
    expect(ok("spam.com", "嗨")).toEqual({ ok: false, error: "has_link" });
  });

  it("does not mistake version numbers or ids for links", () => {
    expect(ok("阿明", "1.8.9 版本 #1234 3.5 分")).toMatchObject({ ok: true });
  });

  it.each(["線上娛樂城", "加賴 abc", "代儲便宜"])("rejects blocked words: %j", (body) => {
    expect(ok("阿明", body)).toEqual({ ok: false, error: "blocked_word" });
  });

  it("strips control characters and collapses long blank runs", () => {
    expect(ok("阿\u0000明", "第一行\n\n\n\n第二行\r\n\t第三行")).toEqual({
      ok: true,
      nickname: "阿明",
      body: "第一行\n\n第二行\n第三行",
    });
  });

  it("keeps nicknames on one line", () => {
    expect(ok("阿\n明", "嗨")).toMatchObject({ ok: true, nickname: "阿 明" });
  });

  it("rejects non-string input", () => {
    expect(validateMessage({ nickname: 1, body: null })).toEqual({ ok: false, error: "bad_request" });
  });
});
