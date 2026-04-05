import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { createGateway } from "@ai-sdk/gateway";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the Vercel AI Gateway API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|vercel_ai_gateway",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  if (!credentials?.apiKey) {
    return [];
  }

  const gateway = createGateway({
    apiKey: credentials.apiKey,
  });

  try {
    await initRegistry();

    const availableModels = await gateway.getAvailableModels();
    // console.log("availableModels", JSON.stringify(availableModels, null, 2));

    const result: Preference.LLMModel[] = await Promise.all(availableModels.models
      .filter((model) => model.modelType === "language")
      .map(async (model) => {
        const modelId = model.id;
        const info = await getModel(modelId);

        // Calculate pricing from API (convert from per-token to per-million tokens)
        const apiInputPrice = model.pricing?.input
          ? Number(model.pricing.input) * 1000000
          : 0;
        const apiOutputPrice = model.pricing?.output
          ? Number(model.pricing.output) * 1000000
          : 0;

        // Use registry data as primary, fall back to API data, then defaults
        const inputPrice = info?.inputPricePerMillion || apiInputPrice || 0;
        const outputPrice = info?.outputPricePerMillion || apiOutputPrice || 0;
        const visionEnable = info?.supportsVision ?? model.name?.toLowerCase().includes("vision") ?? false;
        const toolUse = info?.supportsToolUse ?? true;
        const context = info?.maxInputTokens || 128000;
        const maxTokens = info?.maxOutputTokens || 8192;

        const llmModel: Preference.LLMModel & { preferences?: any[] } = {
          type: "llm_model",
          title: model.name || modelId,
          value: modelId,
          context: context,
          inputPrice: inputPrice,
          outputPrice: outputPrice,
          toolUse: toolUse,
          visionEnable: visionEnable,
          maxTokens: maxTokens,
          modelType: model.modelType,
          systemMessageEnable: info?.supportsSystemMessages ?? true,
          audioEnable: info?.supportsAudioInput || false,
          videoEnable: info?.supportsVideoInput || false,
        };

        const reasoningPref = getReasoningEffortPreference(modelId);
        if (reasoningPref) {
          llmModel.preferences = [reasoningPref];
        }

        return llmModel;
      }));

    return result;
  } catch (error) {
    console.error("Error fetching Vercel AI Gateway models:", error);
    return [];
  }
}

/** Vercel AI Gateway models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Vercel AI Gateway model list
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
