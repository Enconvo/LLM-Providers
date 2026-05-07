import { ListCache, RequestOptions } from "@enconvo/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fuzzysort from "fuzzysort";

const execFileAsync = promisify(execFile);
const DEFAULT_AGENT = "openclaw:main";
const TABLE_SEPARATOR = "\u2502";

const FALLBACK_MODELS: ListCache.ListItem[] = [
  {
    type: "llm_model",
    title: DEFAULT_AGENT,
    value: DEFAULT_AGENT,
    context: 128000,
    toolUse: false,
    visionEnable: true,
    autoContextCompact: false,
    systemMessageEnable: true,
  },
];

function normalizeAgentName(agentName: string): string | null {
  const cleaned = agentName.trim().replace(/^["']|["']$/g, "");

  if (!cleaned || /^[-+|]+$/.test(cleaned)) {
    return null;
  }

  if (
    /^(name|agent|agents|id|model|models|description|default)$/i.test(cleaned)
  ) {
    return null;
  }

  if (cleaned.startsWith("openclaw:")) {
    return cleaned;
  }

  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(cleaned)) {
    return `openclaw:${cleaned}`;
  }

  return null;
}

function extractAgentsFromJson(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(extractAgentsFromJson);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.model || record.value || record.id || record.name || record.agent;

    if (typeof candidate === "string") {
      const normalized = normalizeAgentName(candidate);
      return normalized ? [normalized] : [];
    }

    for (const key of ["agents", "models", "data", "items"]) {
      if (key in record) {
        return extractAgentsFromJson(record[key]);
      }
    }
  }

  return [];
}

function extractAgents(output: string): string[] {
  const text = output.replace(/\u001b\[[0-9;]*m/g, "");
  const agents = new Set<string>();

  for (const match of text.matchAll(/\bopenclaw:[A-Za-z0-9._-]+\b/g)) {
    const normalized = normalizeAgentName(match[0]);
    if (normalized) {
      agents.add(normalized);
    }
  }

  try {
    for (const agent of extractAgentsFromJson(JSON.parse(text))) {
      agents.add(agent);
    }
  } catch {
    // Most CLI versions print tables or plain text.
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.includes(TABLE_SEPARATOR)) {
      const firstCell = trimmed
        .split(TABLE_SEPARATOR)
        .map((cell) => cell.trim())
        .filter(Boolean)[0];
      const normalized = firstCell ? normalizeAgentName(firstCell) : null;
      if (normalized) {
        agents.add(normalized);
      }
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+([A-Za-z0-9][A-Za-z0-9._-]*)\b/);
    const tableMatch = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s{2,}/);
    const singleMatch = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)$/);
    const candidate = bulletMatch?.[1] || tableMatch?.[1] || singleMatch?.[1];
    const normalized = candidate ? normalizeAgentName(candidate) : null;

    if (normalized) {
      agents.add(normalized);
    }
  }

  return [...agents];
}

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "openclaw",
      ["agents", "list"],
      { timeout: 5000 },
    );
    const agents = extractAgents(`${stdout}\n${stderr}`);

    if (agents.length === 0) {
      return FALLBACK_MODELS;
    }

    return agents.map((agent) => ({
      type: "llm_model",
      title: agent,
      value: agent,
      context: 128000,
      toolUse: false,
      visionEnable: true,
      autoContextCompact: false,
      systemMessageEnable: true,
    }));
  } catch {
    return FALLBACK_MODELS;
  }
}

interface OpenClawModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

export default async function main(request: Request) {
  const params = (await request
    .json()
    .catch(() => ({}))) as OpenClawModelsParams;
  const modelCache = new ListCache(fetchModels);
  const models = await modelCache.getList(params as RequestOptions);

  if (params.query) {
    const results = fuzzysort.go(params.query, models, {
      keys: ["title", "value"],
      threshold: -1000,
    });
    return Response.json(results.map((r) => r.obj));
  }

  return Response.json(models);
}
