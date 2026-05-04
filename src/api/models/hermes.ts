import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import axios from "axios";
import fuzzysort from "fuzzysort";

const DEFAULT_MODEL = "hermes-agent";
const DEFAULT_BASE_URL = "http://127.0.0.1:8642/v1";

const FALLBACK_MODELS: ListCache.ListItem[] = [
  {
    type: "llm_model",
    title: DEFAULT_MODEL,
    value: DEFAULT_MODEL,
    context: 128000,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: true,
  },
];

const NON_CHAT_KEYWORDS = [
  "embedding",
  "audio",
  "image",
  "moderation",
  "rerank",
  "tts",
  "whisper",
];

function normalizeBaseUrl(baseUrl: string): string {
  let normalized = baseUrl.trim().replace(/\/+$/, "");
  normalized = normalized.replace(/\/v1\/chat\/completions$/i, "/v1");
  normalized = normalized.replace(/\/chat\/completions$/i, "");

  if (!/\/v1$/i.test(normalized)) {
    normalized = `${normalized}/v1`;
  }

  return normalized;
}

async function loadCredentials(): Promise<Record<string, any>> {
  try {
    const config = await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|hermes",
      includes: ["credentials"],
      useAsRunParams: true,
    });
    return config.credentials || {};
  } catch {
    return {};
  }
}

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const credentials = await loadCredentials();
  const baseUrl = normalizeBaseUrl(credentials.baseUrl || DEFAULT_BASE_URL);
  const headers: Record<string, string> = {};

  if (credentials.apiKey) {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }

  try {
    const response = await axios.get(`${baseUrl}/models`, {
      headers,
      timeout: 5000,
    });
    const data = response.data?.data;

    if (!Array.isArray(data) || data.length === 0) {
      return FALLBACK_MODELS;
    }

    const models = data
      .map((item: any) => item?.value || item?.id)
      .filter(
        (model: unknown): model is string =>
          typeof model === "string" &&
          model.length > 0 &&
          !NON_CHAT_KEYWORDS.some((keyword) =>
            model.toLowerCase().includes(keyword),
          ),
      );

    if (models.length === 0) {
      return FALLBACK_MODELS;
    }

    return models.map((model) => ({
      type: "llm_model",
      title: model,
      value: model,
      context: 128000,
      toolUse: false,
      visionEnable: true,
      systemMessageEnable: true,
    }));
  } catch {
    return FALLBACK_MODELS;
  }
}

interface HermesModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

export default async function main(request: Request) {
  const params = (await request.json().catch(() => ({}))) as HermesModelsParams;
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
