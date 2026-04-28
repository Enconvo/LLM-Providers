import { ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const v25ProPref = getReasoningEffortPreference("mimo-v2.5-pro");
  const v25Pref = getReasoningEffortPreference("mimo-v2.5");

  return [
    {
      type: "llm_model",
      title: "MiMo v2.5 Pro",
      value: "mimo-v2.5-pro",
      providerName: "xiaomi_mimo",
      context: 256000,
      maxTokens: 131072,
      inputPrice: 1,
      outputPrice: 3,
      toolUse: true,
      visionEnable: true,
      audioEnable: true,
      videoEnable: false,
      systemMessageEnable: true,
      ...(v25ProPref ? { preferences: [v25ProPref] } : {}),
    },
    {
      type: "llm_model",
      title: "MiMo v2.5",
      value: "mimo-v2.5",
      providerName: "xiaomi_mimo",
      context: 256000,
      maxTokens: 32768,
      inputPrice: 0.4,
      outputPrice: 2,
      toolUse: true,
      visionEnable: true,
      audioEnable: true,
      videoEnable: false,
      systemMessageEnable: true,
      ...(v25Pref ? { preferences: [v25Pref] } : {}),
    },
  ];
}

/** Xiaomi MiMo models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Xiaomi MiMo model list
 * @param {Request} request - Request object, body is {@link ModelsParams}
 * @returns List of available models, optionally filtered by fuzzy search query
 */
export default async function main(request: Request) {
  const params = (await request.json()) as ModelsParams;
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
