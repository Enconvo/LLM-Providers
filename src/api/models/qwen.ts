import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";
import axios from "axios";
import { qwen_models_data } from "../../utils/qwen_models_data.ts";

/**
 * Fetches models from the Qwen API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|qwen",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;
  if (credentials?.credentials_type?.value === "oauth2") {
    return qwen_models_data;
  }

  let url = credentials?.baseUrl?.endsWith("/")
    ? credentials?.baseUrl
    : `${credentials?.baseUrl}/`;
  url = `${url}models`;

  if (!url || !credentials?.apiKey) {
    return [];
  }
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${credentials?.apiKey}`,
    },
  });

  if (resp.status !== 200) {
    throw new Error(`API request failed with status ${resp.status}`);
  }

  // Ensure registry is loaded before the loop (single init, all lookups are in-memory after this)
  await initRegistry();

  const data = resp.data;
  const results = await Promise.all(
    data.data
      .map(async (item: any) => {
        if (item.value) {
          return item;
        }

        const modelId = item.value || item.id;
        const info = await getModel(modelId);
        const reasoningPref = getReasoningEffortPreference(modelId);

        return {
          type: "llm_model",
          title: item.id,
          value: modelId,
          context: info?.maxInputTokens ?? 8000,
          maxTokens: info?.maxOutputTokens ?? undefined,
          inputPrice: info?.inputPricePerMillion ?? 0,
          outputPrice: info?.outputPricePerMillion ?? 0,
          toolUse: info?.supportsToolUse ?? false,
          visionEnable: info?.supportsVision ?? false,
          audioEnable: info?.supportsAudioInput ?? false,
          videoEnable: info?.supportsVideoInput ?? false,
          systemMessageEnable: info?.supportsSystemMessages ?? true,
          ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
        };
      }),
  );

  return results;
}

/** Qwen models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Qwen model list
 * @param {Request} request - Request object, body is {@link ModelsParams}
 * @returns List of available models, optionally filtered by fuzzy search query
 */
export default async function main(request: Request) {
  const params = await request.json() as ModelsParams;
  const modelCache = new ListCache(fetchModels);
  const models = await modelCache.getList(params);

  if (params.query) {
    const results = fuzzysort.go(params.query, models, {
      keys: ["title", "value"],
      threshold: -1000,
    });
    return Response.json(results.map((r) => r.obj));
  }

  return Response.json(models);
}
