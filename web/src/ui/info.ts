export interface InfoDialogs {
  /** Run `fn` whenever dialog `id` opens; immediately too if it is open already (deep link). */
  onOpen(id: string, fn: () => void): void;
}

/**
 * "怎麼穿上" / "關於" / "留言板" live in <dialog class="info"> instead of below the
 * endless wall, where nobody could ever scroll to them.
 */
export function mountInfoDialogs(doc: Document): InfoDialogs {
  const dialogs = [...doc.querySelectorAll<HTMLDialogElement>("dialog.info[id]")];
  const byHash = (hash: string): HTMLDialogElement | undefined => dialogs.find((d) => `#${d.id}` === hash);
  const listeners = new Map<string, Array<() => void>>();

  const show = (dialog: HTMLDialogElement): void => {
    if (dialog.open) return;
    dialog.showModal();
    for (const fn of listeners.get(dialog.id) ?? []) fn();
  };

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
    show(dialog);
  });

  const openFromHash = (): void => {
    const dialog = byHash(location.hash);
    if (dialog) show(dialog);
  };
  // a link to /#how from elsewhere only changes the hash when the page is already open
  doc.defaultView?.addEventListener("hashchange", openFromHash);
  openFromHash();

  return {
    onOpen(id, fn) {
      listeners.set(id, [...(listeners.get(id) ?? []), fn]);
      if (dialogs.find((d) => d.id === id)?.open) fn();
    },
  };
}
