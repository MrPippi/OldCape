import { mountInfoDialogs } from "./info";

/** jsdom has no HTMLDialogElement API; mimic the parts the module uses. */
function stubDialogs(root: ParentNode): void {
  for (const dialog of root.querySelectorAll<HTMLDialogElement>("dialog")) {
    dialog.showModal = () => dialog.setAttribute("open", "");
    dialog.close = () => {
      dialog.removeAttribute("open");
      dialog.dispatchEvent(new Event("close"));
    };
  }
}

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <nav><a id="to-how" href="#how">怎麼穿上</a><a id="to-finder" href="#finder">圖鑑</a></nav>
    <dialog class="info" id="how"><button type="button" class="x">✕</button><p id="body">說明</p></dialog>`;
  document.body.append(root);
  stubDialogs(root);
  return root;
}

const dialog = (): HTMLDialogElement => document.getElementById("how") as HTMLDialogElement;

describe("mountInfoDialogs", () => {
  afterEach(() => {
    document.body.replaceChildren();
    history.replaceState(null, "", "/");
  });

  it("opens the dialog from its nav link instead of jumping", () => {
    setup();
    mountInfoDialogs(document);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.getElementById("to-how")?.dispatchEvent(click);
    expect(dialog().open).toBe(true);
    expect(click.defaultPrevented).toBe(true);
  });

  it("leaves links to non-dialog targets alone", () => {
    setup();
    mountInfoDialogs(document);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.getElementById("to-finder")?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("closes from the close button", () => {
    setup();
    mountInfoDialogs(document);
    dialog().showModal();
    dialog().querySelector<HTMLButtonElement>(".x")?.click();
    expect(dialog().open).toBe(false);
  });

  it("closes when the backdrop (the dialog box itself) is clicked, not its content", () => {
    setup();
    mountInfoDialogs(document);
    dialog().showModal();
    document.getElementById("body")?.click();
    expect(dialog().open).toBe(true);
    dialog().click();
    expect(dialog().open).toBe(false);
  });

  it("opens on load when the URL hash names a dialog", () => {
    history.replaceState(null, "", "/#how");
    setup();
    mountInfoDialogs(document);
    expect(dialog().open).toBe(true);
  });

  it("drops the hash on close but keeps the cape query", () => {
    history.replaceState(null, "", "/?cape=12#how");
    setup();
    mountInfoDialogs(document);
    dialog().close();
    expect(location.pathname + location.search + location.hash).toBe("/?cape=12");
  });

  it("ignores a hash that is not a dialog", () => {
    history.replaceState(null, "", "/#finder");
    setup();
    expect(() => mountInfoDialogs(document)).not.toThrow();
    expect(dialog().open).toBe(false);
  });
});
