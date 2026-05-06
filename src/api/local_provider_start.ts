import { controlLocalProvider } from "../utils/local_provider_runtime.js";

type LocalProviderName = "openclaw" | "hermes" | "ollama";
type LocalProviderControlAction = "start" | "stop";

interface LocalProviderStartRequest {
  /** Provider to control: openclaw, hermes, or ollama */
  provider: string;
  /** Control action @default start */
  action?: string;
  /** Return a LAN base URL when available */
  lan?: boolean;
  /** Override the host used for API probes */
  host?: string;
  /** Override the provider API port */
  port?: number;
  /** Command timeout in milliseconds */
  timeoutMs?: number;
}

function isLocalProviderName(value: unknown): value is LocalProviderName {
  return value === "openclaw" || value === "hermes" || value === "ollama";
}

function isControlAction(
  value: unknown,
): value is LocalProviderControlAction | undefined {
  return value === "start" || value === "stop" || value === undefined;
}

/**
 * Start or stop a supported local provider service
 * @param {Request} request - Request object, body is {@link LocalProviderStartRequest}
 * @returns command result and refreshed runtime status for the local provider
 */
export default async function main(request: Request) {
  const params = (await request.json()) as LocalProviderStartRequest;

  if (!isLocalProviderName(params.provider)) {
    return Response.json(
      {
        provider: params.provider,
        started: false,
        stopped: false,
        command: null,
        status: null,
        warnings: [],
        errors: [`Unsupported local provider: ${params.provider}`],
      },
      { status: 400 },
    );
  }

  if (!isControlAction(params.action)) {
    return Response.json(
      {
        provider: params.provider,
        started: false,
        stopped: false,
        command: null,
        status: null,
        warnings: [],
        errors: [`Unsupported local provider action: ${params.action}`],
      },
      { status: 400 },
    );
  }

  return Response.json(
    await controlLocalProvider(
      {
        ...params,
        provider: params.provider,
      },
      params.action || "start",
    ),
  );
}
