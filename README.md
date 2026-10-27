# 老披風 OldCape

台灣麥塊玩家披風典藏：瀏覽、搜尋、下載可在遊戲中穿上的 64×32 披風貼圖。

- `pipeline/` — Python：從預覽圖還原貼圖、上色票、去重、打包合輯圖與索引
- `web/` — Vite + TypeScript 靜態網站（Cloudflare Pages）
- `docs/superpowers/` — 設計文件與實作計畫

## 開發

```bash
# 素材處理（Python 3.12+）
cd pipeline && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
.venv/Scripts/python -m oldcape.build --src <披風來源資料夾> --out ../web/public/data [--zip ../release/oldcape-capes.zip]
.venv/Scripts/python -m pytest --cov=oldcape

# 字型子集（來源字型放在 vendor/fonts/）
#   Cubic_11.ttf          https://github.com/ACh-K/Cubic-11（已提交）
#   NotoSerifTC[wght].ttf https://github.com/google/fonts/tree/main/ofl/notoseriftc（太大，不提交）
.venv/Scripts/python -m oldcape.fonts

# 網站（Node 22）
cd web && npm ci
npm run dev        # 開發
npm test           # 單元測試（Vitest）
npm run e2e        # 端對端測試（Playwright，會先 build）
npm run build      # 輸出到 web/dist
```

修改標題文字時，記得同步更新 `pipeline/oldcape/fonts.py` 的 `TITLE_TEXT` 並重新產生字型子集。

## 下架申請（移除披風）

作者可以從披風頁的「申請移除這件披風」或 [GitHub Issue 表單](https://github.com/MrPippi/OldCape/issues/new?template=cape-removal.yml)提出申請（標籤 `removal-request`）。處理方式：

1. 把編號加進 `pipeline/removed.txt`（一行一個，`#` 後可寫 issue 編號）。
2. 重新建置資料：`python -m oldcape.build --src <來源> --out ../web/public/data --zip ../release/oldcape-capes.zip`。該作品與所有圖案相同的重複編號都會被排除。
3. 推送 `web/public/data`（網址的 `?r=` 會自動換新，舊快取不會殘留），並把新的 zip 上傳到 GitHub Release，覆蓋舊檔。
4. 回覆並關閉 issue。
