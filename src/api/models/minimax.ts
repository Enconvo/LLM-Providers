import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";
import Anthropic from "@anthropic-ai/sdk";

async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|minimax",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  if (!credentials?.apiKey) {
    return [];
  }

  const anthropic = new Anthropic({
    apiKey: credentials?.apiKey,
    baseURL: credentials?.baseUrl,
  });

  await initRegistry();

  const models = await anthropic.models.list();

  let result: Preference.ListItem[] = [];
  for await (const page of models.iterPages()) {
    const items = await Promise.all(
      page.data.map(async (item) => {
        const info = await getModel(item.id);
        const reasoningPref = getReasoningEffortPreference(item.id, "minimax");

        const model: Preference.LLMModel = {
          type: "llm_model",
          title: item.display_name,
          value: item.id,
          providerName: "minimax",
          context: info?.maxInputTokens ?? 204800,
          maxTokens: info?.maxOutputTokens ?? 64000,
          inputPrice: info?.inputPricePerMillion ?? 1,
          outputPrice: info?.outputPricePerMillion ?? 1,
          toolUse: info?.supportsToolUse ?? true,
          visionEnable: info?.supportsVision ?? true,
          searchToolSupported: true,
          ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
        };
        return model;
      }),
    );
    result.push(...items);
  }

  return result;
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
