import { getLocalProviderStatus } from "../utils/local_provider_runtime.js";

type LocalProviderName = "openclaw" | "hermes" | "ollama";

interface LocalProviderStatusRequest {
  /** Provider to inspect: openclaw, hermes, or ollama */
  provider: string;
  /** Return a LAN base URL when available */
  lan?: boolean;
  /** Override the host used for API probes */
  host?: string;
  /** Override the provider API port */
  port?: number;
}

function isLocalProviderName(value: unknown): value is LocalProviderName {
  return value === "openclaw" || value === "hermes" || value === "ollama";
}

/**
 * Check whether a local provider is installed and whether its local API is running
 * @param {Request} request - Request object, body is {@link LocalProviderStatusRequest}
 * @returns install state, running state, base URL, and health checks for the local provider
 */
export default async function main(request: Request) {
  const params = (await request.json()) as LocalProviderStatusRequest;

  if (!isLocalProviderName(params.provider)) {
    return Response.json(
      {
        provider: params.provider,
        installed: false,
        running: false,
        executable: null,
        baseUrl: null,
        checks: {},
        warnings: [],
        errors: [`Unsupported local provider: ${params.provider}`],
      },
      { status: 400 },
    );
  }

  return Response.json(
    await getLocalProviderStatus({
      ...params,
      provider: params.provider,
    }),
  );
}
