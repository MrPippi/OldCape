import type { Env } from "./env";

/**
 * Call the one chat room. A deploy resets Durable Objects and in-flight calls fail with
 * "please retry"; every call here is safe to repeat, so retry once on a fresh stub.
 */
export async function roomFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const call = () => env.CHAT.get(env.CHAT.idFromName("lobby")).fetch(`https://chat${path}`, init);
  try {
    return await call();
  } catch (error) {
    console.warn("chat: room call failed, retrying once", path, error);
    return call();
  }
}
