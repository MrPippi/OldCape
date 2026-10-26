/**
 * "怎麼穿上" / "關於" live in <dialog class="info"> instead of below the
 * endless wall, where nobody could ever scroll to them.
 */
export function mountInfoDialogs(doc: Document): void {
  const dialogs = [...doc.querySelectorAll<HTMLDialogElement>("dialog.info[id]")];
  const byHash = (hash: string): HTMLDialogElement | undefined => dialogs.find((d) => `#${d.id}` === hash);

  for (const dialog of dialogs) {
    dialog.querySelector(".x")?.addEventListener("click", () => dialog.close());
    // A click whose target is the dialog box itself landed on the ::backdrop.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (location.hash === `#${dialog.id}`) history.replaceState(history.state, "", location.pathname + location.search);
    });
  }

  doc.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest?.("a[href^='#']");
    const dialog = link && byHash(link.getAttribute("href") ?? "");
    if (!dialog) return;
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  });

  byHash(location.hash)?.showModal();
}
