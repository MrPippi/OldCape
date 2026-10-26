import { fixtureIndex } from "../data/fixture";
import { mountFinder } from "./finder";

function setup() {
  const root = document.createElement("section");
  document.body.replaceChildren(root);
  const events = { onFilter: vi.fn(), onOpen: vi.fn(), onNotFound: vi.fn() };
  const api = mountFinder(root, fixtureIndex(), events);
  const swatches = () => [...root.querySelectorAll<HTMLButtonElement>(".sw button")];
  const submit = (value: string) => {
    root.querySelector<HTMLInputElement>("input")!.value = value;
    root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  };
  return { root, events, api, swatches, submit };
}

describe("mountFinder", () => {
  it("renders 12 colour swatches, none pressed", () => {
    const { swatches } = setup();
    expect(swatches()).toHaveLength(12);
    expect(swatches().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(swatches()[0].getAttribute("aria-label")).toBe("紅");
  });

  it("toggles colours into an AND mask", () => {
    const { swatches, events } = setup();
    swatches()[0].click();
    swatches()[2].click();
    expect(events.onFilter).toHaveBeenLastCalledWith((1 << 0) | (1 << 2));
    expect(swatches()[0].getAttribute("aria-pressed")).toBe("true");
    swatches()[0].click();
    expect(events.onFilter).toHaveBeenLastCalledWith(1 << 2);
  });

  it("opens a cape by full-width id", () => {
    const { submit, events } = setup();
    submit("＃１２");
    expect(events.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
  });

  it("opens the canonical cape for an alias id", () => {
    const { submit, events } = setup();
    submit("20");
    expect(events.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it.each(["999", "abc"])("reports %s as not found with a random fallback", (raw) => {
    const { submit, events, root } = setup();
    submit(raw);
    expect(events.onNotFound).toHaveBeenCalledWith(raw);
    expect(root.textContent).toContain("沒有這個編號");
    const random = root.querySelector<HTMLButtonElement>(".msg button");
    expect(random?.textContent).toContain("隨機看一件");
    random?.click();
    expect(events.onOpen).toHaveBeenCalledTimes(1);
  });

  it("clears the not-found message after a successful search", () => {
    const { submit, root } = setup();
    submit("999");
    submit("12");
    expect(root.textContent).not.toContain("沒有這個編號");
  });

  it("formats the match count", () => {
    const { api, root } = setup();
    api.setCount(30780);
    expect(root.querySelector(".cnt")?.textContent).toBe("符合 30,780 件");
  });

  it("random button opens a non-blank cape", () => {
    const { root, events } = setup();
    root.querySelector<HTMLButtonElement>("[data-action=random]")!.click();
    expect(events.onOpen.mock.calls[0][0].blank).toBe(false);
  });
});
