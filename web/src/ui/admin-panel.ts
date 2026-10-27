import type { AdminApi, AdminMessage } from "../data/admin-api";
import { ApiError } from "../data/guestbook-api";
import { h } from "./dom";
import { relativeTime } from "./relative-time";

const TOKEN_KEY = "oldcape:admin-token";
const CONFIRM_RESET_MS = 4000;

export interface AdminDeps {
  makeApi: (token: string) => AdminApi;
  /** sessionStorage: the token lives only as long as this tab. */
  storage: Storage | null;
  now: () => number;
}

function read(storage: Storage | null): string | null {
  try {
    return storage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}
function write(storage: Storage | null, token: string | null): void {
  try {
    if (token === null) storage?.removeItem(TOKEN_KEY);
    else storage?.setItem(TOKEN_KEY, token);
  } catch {
    /* without storage the token is simply asked for again */
  }
}

function errorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  if (code === "unauthorized") return "管理密碼不對。";
  if (code === "admin_disabled") return "管理功能尚未開啟：請先在 Cloudflare 為 Worker 設定 ADMIN_TOKEN（至少 32 個字元）。";
  if (code === "not_found") return "這則訊息已經不存在。";
  return "連線失敗，請再試一次。";
}

/** Chat moderation: sign in with the admin token, then hide, show or delete messages. */
export function mountAdmin(root: HTMLElement, deps: AdminDeps): void {
  const status = h("p", { class: "adm-status", role: "status" });

  const showLogin = (message = ""): void => {
    const token = h("input", { name: "token", id: "adm-token", type: "password", autocomplete: "current-password", required: true });
    const form = h("form", { class: "adm-login" },
      h("label", { for: "adm-token" }, "管理密碼"),
      token,
      h("button", { type: "submit", class: "b1" }, "登入"));
    status.textContent = message;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = token.value.trim();
      if (value) signIn(value);
    });
    root.replaceChildren(h("h1", {}, "聊天室管理"), form, status);
    token.focus();
  };

  const signIn = (token: string): void => {
    const api = deps.makeApi(token);
    status.textContent = "登入中…";
    api
      .list(null)
      .then((page) => {
        write(deps.storage, token);
        showList(api, page.messages, page.more);
      })
      .catch((error: unknown) => {
        write(deps.storage, null);
        showLogin(errorText(error));
      });
  };

  const showList = (api: AdminApi, first: AdminMessage[], firstMore: boolean): void => {
    let messages = first;
    const attention = h("input", { type: "checkbox", name: "attention", id: "adm-attention" });
    const body = h("tbody");
    const more = h("button", { type: "button", class: "b2 adm-more", hidden: !firstMore }, "載入更多");

    const act = (id: number, run: () => Promise<void>, after: (m: AdminMessage) => AdminMessage | null): void => {
      status.textContent = "";
      run()
        .then(() => {
          messages = messages.flatMap((m) => (m.id !== id ? [m] : (after(m) ?? [])));
          render();
        })
        .catch((error: unknown) => {
          status.textContent = errorText(error);
        });
    };

    const deleteButton = (id: number): HTMLButtonElement => {
      const button = h("button", { type: "button", class: "b2 adm-delete" }, "刪除");
      let confirming = false;
      button.addEventListener("click", () => {
        if (!confirming) {
          confirming = true;
          button.textContent = "確定刪除？";
          setTimeout(() => {
            confirming = false;
            button.textContent = "刪除";
          }, CONFIRM_RESET_MS);
          return;
        }
        act(id, () => api.remove(id), () => null);
      });
      return button;
    };

    const row = (m: AdminMessage): HTMLTableRowElement => {
      const toggle = m.hidden
        ? h("button", { type: "button", class: "b2" }, "恢復")
        : h("button", { type: "button", class: "b2" }, "隱藏");
      toggle.addEventListener("click", () =>
        m.hidden
          ? act(m.id, () => api.show(m.id), (x) => ({ ...x, hidden: false, reportCount: 0 }))
          : act(m.id, () => api.hide(m.id), (x) => ({ ...x, hidden: true })));
      const when = new Date(m.createdAt);
      return h("tr", { "data-id": m.id, class: m.hidden ? "is-hidden" : "" },
        h("td", { class: "pixel" }, `#${m.id}`),
        h("td", {}, h("time", { datetime: when.toISOString(), title: when.toLocaleString("zh-TW") }, relativeTime(m.createdAt, deps.now()))),
        h("td", { class: "adm-name" }, m.nickname),
        h("td", { class: "adm-body" }, m.body),
        h("td", { class: "adm-reports" }, String(m.reportCount)),
        h("td", { class: "adm-state" }, m.hidden ? "已隱藏" : "顯示中"),
        h("td", { class: "adm-actions" }, toggle, deleteButton(m.id)));
    };

    const render = (): void => {
      const shown = attention.checked ? messages.filter((m) => m.hidden || m.reportCount > 0) : messages;
      body.replaceChildren(...shown.map(row));
    };

    attention.addEventListener("change", render);
    more.addEventListener("click", () => {
      more.disabled = true;
      api
        .list(messages.at(-1)?.id ?? null)
        .then((page) => {
          messages = [...messages, ...page.messages];
          more.hidden = !page.more;
          render();
        })
        .catch((error: unknown) => {
          status.textContent = errorText(error);
        })
        .finally(() => {
          more.disabled = false;
        });
    });
    const signOut = h("button", { type: "button", class: "b2" }, "登出");
    signOut.addEventListener("click", () => {
      write(deps.storage, null);
      showLogin();
    });

    status.textContent = "";
    root.replaceChildren(
      h("header", { class: "adm-head" },
        h("h1", {}, "聊天室管理"),
        h("label", { class: "adm-filter", for: "adm-attention" }, attention, "只看隱藏或被檢舉"),
        signOut),
      status,
      h("div", { class: "adm-scroll" },
        h("table", { class: "adm-table" },
          h("thead", {}, h("tr", {}, ...["編號", "時間", "暱稱", "內容", "檢舉", "狀態", "操作"].map((t) => h("th", {}, t)))),
          body)),
      more,
    );
    render();
  };

  const kept = read(deps.storage);
  if (kept) signIn(kept);
  else showLogin();
}
