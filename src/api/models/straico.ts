import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";


/**
 * Fetches models from the Straico API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|straico",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const url = "https://api.straico.com/v1/models";
  const type = "chat";

  if (!credentials.apiKey) {
    return [];
  }
  try {
    await initRegistry();

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = await resp.json();
    const result = await Promise.all(data.data[type].map(async (item: any) => {
      const modelId = item.model;
      const info = await getModel(modelId);

      const context = item.context || info?.maxInputTokens || 8000;
      const visionEnable = item.metadata?.features?.includes("Image input") || info?.supportsVision || false;
      const toolUse = info?.supportsToolUse || false;
      const title = item.name || item.model;
      const value = item.model;
      const inputPrice = item.pricing?.coins || info?.inputPricePerMillion || 0;
      const outputPrice = info?.outputPricePerMillion || 0;

      const model: Preference.LLMModel & { preferences?: any[] } = {
        type: "llm_model",
        title: title,
        value: value,
        context: context,
        maxTokens: item.max_output || info?.maxOutputTokens || 10000,
        inputPrice: inputPrice,
        outputPrice: outputPrice,
        perRequestPrice: item.pricing?.coins || 0,
        // @ts-ignore
        perRequestUnit: "100 words",
        toolUse: toolUse,
        visionEnable: visionEnable,
        systemMessageEnable: info?.supportsSystemMessages ?? true,
        audioEnable: info?.supportsAudioInput || false,
        videoEnable: info?.supportsVideoInput || false,
      };

      const reasoningPref = getReasoningEffortPreference(modelId);
      if (reasoningPref) {
        model.preferences = [reasoningPref];
      }

      return model;
    }));

    // console.log("Total models fetched:", result)
    return result;
  } catch (error) {
    return [];
  }
}

/** Straico models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Straico model list
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
