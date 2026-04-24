import { ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const flashPref = getReasoningEffortPreference("deepseek-v4-flash");
  const proPref = getReasoningEffortPreference("deepseek-v4-pro");

  return [
    {
      type: "llm_model",
      title: "DeepSeek V4 Flash",
      value: "deepseek-v4-flash",
      context: 1000000,
      maxTokens: 384000,
      inputPrice: 0.14,
      outputPrice: 0.28,
      toolUse: true,
      visionEnable: false,
      audioEnable: false,
      videoEnable: false,
      systemMessageEnable: true,
      ...(flashPref ? { preferences: [flashPref] } : {}),
    },
    {
      type: "llm_model",
      title: "DeepSeek V4 Pro",
      value: "deepseek-v4-pro",
      context: 1000000,
      maxTokens: 384000,
      inputPrice: 1.64,
      outputPrice: 3.28,
      toolUse: true,
      visionEnable: false,
      audioEnable: false,
      videoEnable: false,
      systemMessageEnable: true,
      ...(proPref ? { preferences: [proPref] } : {}),
    },
  ];
}

/** DeepSeek models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search DeepSeek model list
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
