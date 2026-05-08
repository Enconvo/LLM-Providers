import { Agent, fetch as undiciFetch } from "undici";

// undici defaults keep sockets warm for ~4s but the upstream LB on Anthropic
// (and several proxies) recycles idle connections more aggressively. When the
// SDK reuses a stale socket the response stream throws `terminated` /
// UND_ERR_SOCKET mid-flight. Shorten our pool's idle window so we evict first.
const sharedDispatcher = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 32,
});

type FetchInit = Parameters<typeof undiciFetch>[1];

export const dispatchedFetch: typeof globalThis.fetch = ((
  input: any,
  init?: any,
) => {
  const merged: FetchInit = { ...(init ?? {}), dispatcher: sharedDispatcher };
  return undiciFetch(input, merged);
}) as unknown as typeof globalThis.fetch;

export function isTerminatedSocketError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; code?: string; cause?: any };
  if (e.message === "terminated") return true;
  const code = e.code ?? e.cause?.code;
  if (
    code === "UND_ERR_SOCKET" ||
    code === "UND_ERR_CLOSED" ||
    code === "ECONNRESET" ||
    code === "EPIPE"
  ) {
    return true;
  }
  return false;
}
