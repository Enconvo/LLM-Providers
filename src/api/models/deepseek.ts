import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the DeepSeek API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|deepseek",
      includes: ['credentials'],
      useAsRunParams: true
    });
    // Ensure registry is loaded before lookups
    await initRegistry();

    const chatInfo = await getModel("deepseek-chat");
    const reasonerInfo = await getModel("deepseek-reasoner");
    const reasonerPref = getReasoningEffortPreference("deepseek-reasoner");

    const models: ListCache.ListItem[] = [
      {
        type: "llm_model",
        title: "Deepseek V3",
        value: "deepseek-chat",
        context: chatInfo?.maxInputTokens ?? 64000,
        maxTokens: chatInfo?.maxOutputTokens ?? undefined,
        inputPrice: chatInfo?.inputPricePerMillion ?? 0.14,
        outputPrice: chatInfo?.outputPricePerMillion ?? 0.28,
        toolUse: chatInfo?.supportsToolUse ?? true,
        visionEnable: chatInfo?.supportsVision ?? false,
        audioEnable: chatInfo?.supportsAudioInput ?? false,
        videoEnable: chatInfo?.supportsVideoInput ?? false,
        systemMessageEnable: chatInfo?.supportsSystemMessages ?? true,
      },
      {
        type: "llm_model",
        title: "Deepseek R1",
        value: "deepseek-reasoner",
        context: reasonerInfo?.maxInputTokens ?? 64000,
        maxTokens: reasonerInfo?.maxOutputTokens ?? undefined,
        inputPrice: reasonerInfo?.inputPricePerMillion ?? 0.14,
        outputPrice: reasonerInfo?.outputPricePerMillion ?? 0.28,
        sequenceContentDisable: true,
        systemMessageEnable: reasonerInfo?.supportsSystemMessages ?? false,
        toolUse: reasonerInfo?.supportsToolUse ?? false,
        visionEnable: reasonerInfo?.supportsVision ?? false,
        audioEnable: reasonerInfo?.supportsAudioInput ?? false,
        videoEnable: reasonerInfo?.supportsVideoInput ?? false,
        ...(reasonerPref ? { preferences: [reasonerPref] } : {}),
      },
    ];

    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
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
