/** A rendered Turnstile widget: the current token (single use) and a way to get a fresh one. */
export interface Captcha {
  token(): string | null;
  reset(): void;
}

export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Public site key of the oldcape.org widget (the secret lives only in the Worker). */
export const PROD_SITEKEY = "0x4AAAAAAFnoRc8n8k5w5Cp2";
/** Cloudflare's always-pass test key, for localhost and previews. */
export const TEST_SITEKEY = "1x00000000000000000000AA";

export const sitekeyFor = (host: string): string =>
  host === "oldcape.org" || host === "www.oldcape.org" ? PROD_SITEKEY : TEST_SITEKEY;

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}
type WithTurnstile = Window & { turnstile?: TurnstileApi };

let loading: { script: HTMLScriptElement; promise: Promise<TurnstileApi> } | null = null;

function turnstileApi(): Promise<TurnstileApi> {
  const ready = (window as WithTurnstile).turnstile;
  if (ready) return Promise.resolve(ready);
  if (loading?.script.isConnected) return loading.promise;
  const script = document.createElement("script");
  script.src = TURNSTILE_SCRIPT;
  script.async = true;
  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    script.addEventListener("load", () => {
      const api = (window as WithTurnstile).turnstile;
      if (api) resolve(api);
      else reject(new Error("turnstile: script loaded without its API"));
    });
    script.addEventListener("error", () => {
      loading = null;
      reject(new Error("turnstile: script failed to load"));
    });
  });
  loading = { script, promise };
  document.head.append(script);
  return promise;
}

/** Load Turnstile on demand and render one widget; `onToken` fires each time a check passes. */
export async function loadTurnstile(
  container: HTMLElement,
  sitekey: string,
  onToken: (token: string) => void = () => undefined,
): Promise<Captcha> {
  const api = await turnstileApi();
  let token: string | null = null;
  const id = api.render(container, {
    sitekey,
    theme: "dark",
    language: "zh-tw",
    callback: (t: string) => {
      token = t;
      onToken(t);
    },
    "expired-callback": () => (token = null),
    "error-callback": () => (token = null),
  });
  return {
    token: () => token,
    reset() {
      token = null;
      api.reset(id);
    },
  };
}
