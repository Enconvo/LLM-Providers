import {
  CommandManageUtils,
  ListCache,
  Preference,
  RequestOptions,
} from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { Ollama } from "ollama";
import type { ModelResponse, ShowResponse } from "ollama";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_MAX_OUTPUT_TOKENS = 64000;

const cloudModels = [
  "glm-5.1:cloud",
  "minimax-m2.7:cloud",
  "qwen3.5:cloud",
  "kimi-k2.5:cloud",
  "glm-5:cloud",
  "gemma4:31b-cloud",
  "ministral-3:3b-cloud",
  "ministral-3:8b-cloud",
  "ministral-3:14b-cloud",
];

function normalizeBaseUrl(baseUrl?: string): string {
  const normalized = baseUrl?.trim() || DEFAULT_BASE_URL;

  return normalized
    .replace(/\/+$/, "")
    .replace(/\/api\/tags$/i, "")
    .replace(/\/api$/i, "")
    .replace(/\/v1$/i, "");
}

function parseCustomHeaders(headerString?: string): Record<string, string> {
  if (!headerString) {
    return {};
  }

  const headers: Record<string, string> = {};
  for (const line of headerString.split("\n")) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      headers[key] = value;
    }
  }

  return headers;
}

function readCapabilities(modelInfo?: Partial<ShowResponse>): string[] {
  return Array.isArray(modelInfo?.capabilities) ? modelInfo.capabilities : [];
}

function readContextLength(
  modelInfo?: Partial<ShowResponse>,
): number | undefined {
  const modelInfoRecord = modelInfo?.model_info;
  if (!modelInfoRecord) {
    return undefined;
  }

  const entries =
    modelInfoRecord instanceof Map
      ? Array.from(modelInfoRecord.entries())
      : Object.entries(modelInfoRecord);
  const rawValue = entries.find(([key]) =>
    key.endsWith(".context_length"),
  )?.[1];
  const parsedValue =
    typeof rawValue === "number" ? rawValue : Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function isEmbeddingOnlyModel(
  item: ModelResponse,
  capabilities: string[],
): boolean {
  if (capabilities.length > 0) {
    return (
      capabilities.includes("embedding") && !capabilities.includes("completion")
    );
  }

  const searchableText = [
    item.name,
    item.model,
    item.details?.family,
    ...(item.details?.families || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(embed|embedding|bert)\b/.test(searchableText);
}

async function getRegistryModel(modelName: string) {
  try {
    return await getModel(modelName);
  } catch {
    return undefined;
  }
}

async function loadCredentials(): Promise<Record<string, any>> {
  try {
    const config = await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|ollama",
      includes: ["credentials"],
      useAsRunParams: true,
    });
    return config.credentials || {};
  } catch {
    return {};
  }
}

async function toListModel(
  ollama: Ollama,
  item: ModelResponse,
): Promise<Preference.LLMModel | null> {
  let modelInfo: Partial<ShowResponse> | undefined;

  try {
    modelInfo = await ollama.show({ model: item.name });
  } catch (err) {
    console.warn(
      `Failed to inspect Ollama model "${item.name}"; using list metadata only.`,
      err,
    );
  }

  const capabilities = readCapabilities(modelInfo);
  const hasCapabilityMetadata = Array.isArray(modelInfo?.capabilities);

  if (hasCapabilityMetadata && !capabilities.includes("completion")) {
    return null;
  }

  if (!hasCapabilityMetadata && isEmbeddingOnlyModel(item, capabilities)) {
    return null;
  }

  const modelRegistryInfo = await getRegistryModel(item.name);
  const model: Preference.LLMModel = {
    title: item.name,
    value: item.name,
    type: "llm_model",
    providerName: item.details?.family || "ollama",
    toolUse: capabilities.includes("tools"),
    thinking: capabilities.includes("thinking"),
    context:
      readContextLength(modelInfo) ||
      modelRegistryInfo?.maxInputTokens ||
      DEFAULT_CONTEXT_WINDOW,
    maxTokens: modelRegistryInfo?.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
    visionEnable: capabilities.includes("vision"),
    systemMessageEnable: true,
  };

  if (model.thinking) {
    const reasoningPref = getReasoningEffortPreference(item.name, "ollama");
    if (reasoningPref) {
      model.preferences = [reasoningPref];
    }
  }

  return model;
}

async function fetchModels(_options: RequestOptions) {
  const credentials = await loadCredentials();

  const headers: Record<string, string> = {
    ...parseCustomHeaders(credentials?.customHeaders as string | undefined),
    "User-Agent": "Enconvo/1.0",
  };
  if (credentials?.apiKey) {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }

  const ollama = new Ollama({
    host: normalizeBaseUrl(credentials?.baseUrl as string | undefined),
    headers,
  });

  let models: ListCache.ListItem[] = [];
  try {
    await Promise.all([
      initRegistry(),
      ...cloudModels.map((model) => ollama.pull({ model }).catch(() => {})),
    ]);

    const list = await ollama.list();
    models = (
      await Promise.all(list.models.map((item) => toListModel(ollama, item)))
    ).filter((item): item is Preference.LLMModel => item !== null);
  } catch (err) {
    console.log(err);
  }

  return models;
}

/** Ollama models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Ollama model list
 * @param {Request} request - Request object, body is {@link ModelsParams}
 * @returns List of available models, optionally filtered by fuzzy search query
 */
export default async function main(request: Request) {
  const params = (await request.json().catch(() => ({}))) as ModelsParams;
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
