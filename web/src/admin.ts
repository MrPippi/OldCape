import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/admin.css";

import { adminApi } from "./data/admin-api";
import { mountAdmin } from "./ui/admin-panel";

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const root = document.getElementById("admin");
if (!root) throw new Error("admin: #admin missing");
mountAdmin(root, { makeApi: (token) => adminApi(token), storage: safeSessionStorage(), now: Date.now });
