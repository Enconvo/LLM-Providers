import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LocalProviderName = "openclaw" | "hermes" | "ollama";
export type LocalProviderControlAction = "start" | "stop";

export interface LocalProviderRuntimeParams {
  provider: LocalProviderName;
  lan?: boolean;
  host?: string;
  port?: number;
  timeoutMs?: number;
}

export interface CommandResult {
  command: string;
  args: string[];
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface LocalProviderStatusResult {
  provider: LocalProviderName;
  installed: boolean;
  running: boolean;
  executable: string | null;
  baseUrl: string | null;
  checks: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

export interface LocalProviderControlResult {
  provider: LocalProviderName;
  action: LocalProviderControlAction;
  started: boolean;
  stopped: boolean;
  command: CommandResult | null;
  status: LocalProviderStatusResult;
  warnings: string[];
  errors: string[];
}

const DEFAULT_TIMEOUT_MS = 15000;
const OPENCLAW_CONFIG_PATH = "~/.openclaw/openclaw.json";
const HERMES_ENV_PATH = "~/.hermes/.env";
const OPENCLAW_DEFAULT_PORT = 18789;
const HERMES_DEFAULT_PORT = 8642;
const OLLAMA_DEFAULT_PORT = 11434;
const PROVIDER_START_STATUS_TIMEOUT_MS = 30000;
const PROVIDER_STOP_STATUS_TIMEOUT_MS = 10000;
const PROVIDER_STATUS_POLL_INTERVAL_MS = 1000;
const OLLAMA_BUNDLE_ID = "com.electron.ollama";
const OLLAMA_APP_PATHS = [
  "/System/Volumes/Data/Applications/Ollama.app",
  "/Applications/Ollama.app",
];

function expandHome(value: string) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

async function runCommand(
  command: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
    });
    return {
      command,
      args,
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: unknown) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return {
      command,
      args,
      ok: false,
      stdout: String(err.stdout || "").trim(),
      stderr: String(err.stderr || "").trim(),
      error: err.message,
    };
  }
}

async function findExecutable(name: string, extraPaths: string[] = []) {
  for (const candidate of extraPaths.map(expandHome)) {
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep checking PATH.
    }
  }

  try {
    const { stdout } = await execFileAsync("/bin/sh", [
      "-lc",
      `command -v ${name}`,
    ]);
    return stdout.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string) {
  try {
    const text = await fs.readFile(expandHome(filePath), "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getNestedValue(value: Record<string, unknown> | null, keys: string[]) {
  let current: unknown = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

async function readEnvFile(filePath: string) {
  try {
    return await fs.readFile(expandHome(filePath), "utf8");
  } catch {
    return "";
  }
}

function readEnvValue(text: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escaped}=(.*)$`, "m"));
  const value = match?.[1]?.trim();
  if (!value) {
    return value;
  }
  const quote = value[0];
  if (
    (quote === '"' || quote === "'") &&
    value.endsWith(quote) &&
    value.length >= 2
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePort(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const items of Object.values(interfaces)) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) {
        return item.address;
      }
    }
  }
  return null;
}

function getHost(
  params: LocalProviderRuntimeParams,
  defaultHost = "127.0.0.1",
) {
  if (params.host) {
    return params.host;
  }
  if (params.lan) {
    return getLanIPv4() || defaultHost;
  }
  return defaultHost;
}

async function probeHttp(url: string, apiKey?: string) {
  try {
    const response = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function findOpenClawExecutable() {
  return findExecutable("openclaw", [
    "~/.local/bin/openclaw",
    "/opt/homebrew/bin/openclaw",
    "/usr/local/bin/openclaw",
  ]);
}

async function findHermesExecutable() {
  return findExecutable("hermes", [
    "~/.local/bin/hermes",
    "~/.hermes/hermes-agent/hermes",
    "/opt/homebrew/bin/hermes",
    "/usr/local/bin/hermes",
  ]);
}

async function findOllamaExecutable() {
  return findExecutable("ollama", [
    "/System/Volumes/Data/Applications/Ollama.app/Contents/Resources/ollama",
    "/Applications/Ollama.app/Contents/Resources/ollama",
    "/opt/homebrew/bin/ollama",
    "/usr/local/bin/ollama",
  ]);
}

async function findOllamaAppPath() {
  for (const appPath of OLLAMA_APP_PATHS) {
    if (await pathExists(appPath)) {
      return appPath;
    }
  }
  return null;
}

async function getOllamaInstallPaths() {
  const appPath = await findOllamaAppPath();
  const cliPath = await findOllamaExecutable();

  return {
    appPath,
    cliPath,
    installed: Boolean(appPath),
  };
}

function resolveOpenClawPort(
  params: LocalProviderRuntimeParams,
  config: Record<string, unknown> | null,
) {
  return (
    params.port ||
    readNumber(getNestedValue(config, ["gateway", "http", "port"])) ||
    readNumber(getNestedValue(config, ["gateway", "port"])) ||
    OPENCLAW_DEFAULT_PORT
  );
}

async function getConfiguredOpenClawPort(params: LocalProviderRuntimeParams) {
  return resolveOpenClawPort(params, await readJsonFile(OPENCLAW_CONFIG_PATH));
}

function resolveHermesPort(
  params: LocalProviderRuntimeParams,
  envText: string,
) {
  return (
    params.port ||
    parsePort(readEnvValue(envText, "API_SERVER_PORT")) ||
    HERMES_DEFAULT_PORT
  );
}

async function getConfiguredHermesPort(params: LocalProviderRuntimeParams) {
  return resolveHermesPort(params, await readEnvFile(HERMES_ENV_PATH));
}

async function getOpenClawStatus(
  params: LocalProviderRuntimeParams,
): Promise<LocalProviderStatusResult> {
  const executable = await findOpenClawExecutable();
  if (!executable) {
    return {
      provider: "openclaw",
      installed: false,
      running: false,
      executable: null,
      baseUrl: null,
      checks: {
        installGuide: "https://docs.openclaw.ai/start/getting-started",
      },
      warnings: ["OpenClaw CLI was not found on this Mac."],
      errors: [],
    };
  }

  const config = await readJsonFile(OPENCLAW_CONFIG_PATH);
  const apiKey = readString(
    getNestedValue(config, ["gateway", "auth", "token"]),
  );
  const port = resolveOpenClawPort(params, config);
  const gatewayUrl = `http://${getHost(params)}:${port}`;
  const baseUrl = `${gatewayUrl}/v1`;
  const health = await probeHttp(`${gatewayUrl}/health`);
  const models = apiKey
    ? await probeHttp(`${baseUrl}/models`, apiKey)
    : { ok: false, error: "Missing OpenClaw gateway token" };

  return {
    provider: "openclaw",
    installed: true,
    running: health.ok === true || models.ok === true,
    executable,
    baseUrl,
    checks: {
      configPath: OPENCLAW_CONFIG_PATH,
      apiKeyFound: Boolean(apiKey),
      health,
      models,
    },
    warnings: [],
    errors: [],
  };
}

async function getHermesStatus(
  params: LocalProviderRuntimeParams,
): Promise<LocalProviderStatusResult> {
  const executable = await findHermesExecutable();
  if (!executable) {
    return {
      provider: "hermes",
      installed: false,
      running: false,
      executable: null,
      baseUrl: null,
      checks: {
        installCommand:
          "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
      },
      warnings: ["Hermes CLI was not found on this Mac."],
      errors: [],
    };
  }

  const envText = await readEnvFile(HERMES_ENV_PATH);
  const apiKey = readEnvValue(envText, "API_SERVER_KEY");
  const port = resolveHermesPort(params, envText);
  const baseUrl = `http://${getHost(params)}:${port}/v1`;
  const health = await probeHttp(`${baseUrl}/health`);
  const models = await probeHttp(`${baseUrl}/models`, apiKey);

  return {
    provider: "hermes",
    installed: true,
    running: health.ok === true || models.ok === true,
    executable,
    baseUrl,
    checks: {
      envPath: HERMES_ENV_PATH,
      apiKeyFound: Boolean(apiKey),
      health,
      models,
    },
    warnings: [],
    errors: [],
  };
}

async function getOllamaStatus(
  params: LocalProviderRuntimeParams,
): Promise<LocalProviderStatusResult> {
  const installPaths = await getOllamaInstallPaths();
  if (!installPaths.installed) {
    return {
      provider: "ollama",
      installed: false,
      running: false,
      executable: null,
      baseUrl: null,
      checks: {
        appPath: OLLAMA_APP_PATHS[0],
        manualInstall: "https://ollama.com/download/mac",
      },
      warnings: ["Ollama.app was not found on this Mac."],
      errors: [],
    };
  }

  const port = params.port || OLLAMA_DEFAULT_PORT;
  const baseUrl = `http://${getHost(params)}:${port}`;
  const tags = await probeHttp(`${baseUrl}/api/tags`);
  const version = await probeHttp(`${baseUrl}/api/version`);

  return {
    provider: "ollama",
    installed: true,
    running: tags.ok === true || version.ok === true,
    executable: installPaths.appPath,
    baseUrl,
    checks: {
      appPath: installPaths.appPath,
      cliPath: installPaths.cliPath,
      tags,
      version,
    },
    warnings: [],
    errors: [],
  };
}

export async function getLocalProviderStatus(
  params: LocalProviderRuntimeParams,
): Promise<LocalProviderStatusResult> {
  switch (params.provider) {
    case "openclaw":
      return getOpenClawStatus(params);
    case "hermes":
      return getHermesStatus(params);
    case "ollama":
      return getOllamaStatus(params);
    default:
      return {
        provider: params.provider,
        installed: false,
        running: false,
        executable: null,
        baseUrl: null,
        checks: {},
        warnings: [],
        errors: [`Unsupported local provider: ${params.provider}`],
      };
  }
}

async function startOllama(timeoutMs: number): Promise<CommandResult> {
  const bundleResult = await runCommand(
    "/usr/bin/open",
    ["-b", OLLAMA_BUNDLE_ID, "--args", "hidden"],
    timeoutMs,
  );
  if (bundleResult.ok) {
    return bundleResult;
  }

  const appPath = await findOllamaAppPath();
  if (!appPath) {
    return bundleResult;
  }

  return runCommand("/usr/bin/open", [appPath, "--args", "hidden"], timeoutMs);
}

async function stopOllama(timeoutMs: number): Promise<CommandResult> {
  return runCommand(
    "/bin/sh",
    [
      "-lc",
      [
        `/usr/bin/osascript -e 'tell application id "${OLLAMA_BUNDLE_ID}" to quit' >/dev/null 2>&1 || true`,
        "sleep 1",
        "/usr/bin/pkill -TERM -x Ollama >/dev/null 2>&1 || true",
        "/usr/bin/pkill -TERM -f '/Ollama.app/Contents/Resources/ollama serve' >/dev/null 2>&1 || true",
      ].join("; "),
    ],
    timeoutMs,
  );
}

async function stopGatewayProcess(
  executable: string,
  processName: "openclaw" | "hermes",
  port: number,
  timeoutMs: number,
): Promise<CommandResult> {
  const gatewayRunPattern = `${processName} gateway ru[n]`;
  const lsofListenerCommand = `/usr/sbin/lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null | /usr/bin/sort -u`;

  return runCommand(
    "/bin/sh",
    [
      "-lc",
      [
        `${shellQuote(executable)} gateway stop >/dev/null 2>&1 || true`,
        "sleep 1",
        `pgrep -f ${shellQuote(gatewayRunPattern)} | while read -r pid; do /bin/kill -TERM "$pid" >/dev/null 2>&1 || true; done`,
        `${lsofListenerCommand} | while read -r pid; do /bin/kill -TERM "$pid" >/dev/null 2>&1 || true; done`,
        "sleep 1",
        `pgrep -f ${shellQuote(gatewayRunPattern)} | while read -r pid; do /bin/kill -KILL "$pid" >/dev/null 2>&1 || true; done`,
        `${lsofListenerCommand} | while read -r pid; do /bin/kill -KILL "$pid" >/dev/null 2>&1 || true; done`,
      ].join("; "),
    ],
    timeoutMs,
  );
}

async function runControlCommand(
  params: LocalProviderRuntimeParams & { action: LocalProviderControlAction },
  executable: string,
  timeoutMs: number,
) {
  if (params.provider === "ollama") {
    return params.action === "start"
      ? startOllama(timeoutMs)
      : stopOllama(timeoutMs);
  }

  if (
    (params.provider === "openclaw" || params.provider === "hermes") &&
    params.action === "stop"
  ) {
    const port =
      params.provider === "openclaw"
        ? await getConfiguredOpenClawPort(params)
        : await getConfiguredHermesPort(params);

    return stopGatewayProcess(executable, params.provider, port, timeoutMs);
  }

  return runCommand(executable, ["gateway", params.action], timeoutMs);
}

function providerReachedExpectedState(
  status: LocalProviderStatusResult,
  action: LocalProviderControlAction,
) {
  return action === "start" ? status.running : !status.running;
}

async function waitForProviderState(
  params: LocalProviderRuntimeParams,
  action: LocalProviderControlAction,
): Promise<LocalProviderStatusResult> {
  const deadline =
    Date.now() +
    (action === "start"
      ? PROVIDER_START_STATUS_TIMEOUT_MS
      : PROVIDER_STOP_STATUS_TIMEOUT_MS);
  let status = await getLocalProviderStatus(params);

  while (
    !providerReachedExpectedState(status, action) &&
    Date.now() < deadline
  ) {
    await wait(PROVIDER_STATUS_POLL_INTERVAL_MS);
    status = await getLocalProviderStatus(params);
  }

  return status;
}

export async function controlLocalProvider(
  params: LocalProviderRuntimeParams,
  action: LocalProviderControlAction = "start",
): Promise<LocalProviderControlResult> {
  const timeoutMs = params.timeoutMs || DEFAULT_TIMEOUT_MS;
  const beforeStatus = await getLocalProviderStatus(params);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!beforeStatus.installed || !beforeStatus.executable) {
    return {
      provider: params.provider,
      action,
      started: false,
      stopped: false,
      command: null,
      status: beforeStatus,
      warnings: beforeStatus.warnings,
      errors: beforeStatus.errors,
    };
  }

  const command = await runControlCommand(
    { ...params, action },
    beforeStatus.executable,
    timeoutMs,
  );

  if (!command.ok) {
    errors.push(
      command.error ||
        command.stderr ||
        `${action === "start" ? "Start" : "Stop"} command failed.`,
    );
  }

  const status = await waitForProviderState(params, action);
  if (action === "start" && !status.running) {
    warnings.push(
      `${params.provider} did not report a running API after start.`,
    );
  }
  if (action === "stop" && status.running) {
    warnings.push(`${params.provider} still reports a running API after stop.`);
  }

  return {
    provider: params.provider,
    action,
    started: action === "start" && status.running,
    stopped: action === "stop" && !status.running,
    command,
    status,
    warnings,
    errors,
  };
}
