import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

interface MiniMaxModelDef {
  id: string;
  title: string;
  context: number;
  description: string;
}

const MINIMAX_MODELS: MiniMaxModelDef[] = [
  { id: "MiniMax-M2.7", title: "MiniMax-M2.7", context: 204800, description: "Beginning the journey of recursive self-improvement (~60 tps)" },
  { id: "MiniMax-M2.7-highspeed", title: "MiniMax-M2.7-highspeed", context: 204800, description: "M2.7 highspeed: Same performance, faster and more agile (~100 tps)" },
  { id: "MiniMax-M2.5", title: "MiniMax-M2.5", context: 204800, description: "Peak Performance. Ultimate Value. Master the Complex (~60 tps)" },
  { id: "MiniMax-M2.5-highspeed", title: "MiniMax-M2.5-highspeed", context: 204800, description: "M2.5 highspeed: Same performance, faster and more agile (~100 tps)" },
  { id: "MiniMax-M2.1", title: "MiniMax-M2.1", context: 204800, description: "Powerful Multi-Language Programming with Enhanced Experience (~60 tps)" },
  { id: "MiniMax-M2.1-highspeed", title: "MiniMax-M2.1-highspeed", context: 204800, description: "Faster and More Agile (~100 tps)" },
  { id: "MiniMax-M2", title: "MiniMax-M2", context: 204800, description: "Agentic capabilities, Advanced reasoning" },
];

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  return MINIMAX_MODELS.map((m) => {
    const reasoningPref = getReasoningEffortPreference(m.id, "minimax");

    const model: Preference.LLMModel = {
      type: "llm_model",
      title: m.title,
      value: m.id,
      providerName: "minimax",
      context: m.context,
      maxTokens: 64000,
      inputPrice: 1,
      outputPrice: 1,
      toolUse: true,
      visionEnable: true,
      searchToolSupported: true,
      ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
    };
    return model;
  });
}

/** Minimax models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Minimax model list
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
