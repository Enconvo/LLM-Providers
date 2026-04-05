import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Aimagicx models data with capabilities and context limits
 */
const aimagicx_models_data = [
  // OpenAI Models - Speed and efficiency focused
  {
    value: "4o-mini",
    title: "GPT-4o Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "4o",
    title: "GPT-4o",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4.1",
    title: "GPT-4.1",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4.1-mini",
    title: "GPT-4.1 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "o3",
    title: "O3",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "o3-mini",
    title: "O3 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  // Anthropic Models - Advanced reasoning and understanding
  {
    value: "claude-3-5-sonnet",
    title: "Claude 3.5 Sonnet",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-3-7-sonnet",
    title: "Claude 3.7 Sonnet",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-sonnet-4-20250514",
    title: "Claude Sonnet 4",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-opus-4-20250514",
    title: "Claude Opus 4",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  // Google Models - Large context and ultra-fast processing
  {
    value: "gemini-2.5-flash",
    title: "Gemini 2.5 Flash",
    context: 1000000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gemini-2.5-pro",
    title: "Gemini 2.5 Pro",
    context: 2000000,
    toolUse: true,
    visionEnable: true,
  },
];

/**
 * Enrich a static model entry with registry data
 */
async function enrichModel(m: typeof aimagicx_models_data[number]) {
  const info = await getModel(m.value);

  const model: any = {
    value: m.value,
    title: m.title,
    context: info?.maxInputTokens || m.context,
    maxTokens: info?.maxOutputTokens || undefined,
    inputPrice: info?.inputPricePerMillion || 0,
    outputPrice: info?.outputPricePerMillion || 0,
    toolUse: info?.supportsToolUse ?? m.toolUse,
    visionEnable: info?.supportsVision ?? m.visionEnable,
    systemMessageEnable: info?.supportsSystemMessages ?? true,
    audioEnable: info?.supportsAudioInput || false,
    videoEnable: info?.supportsVideoInput || false,
  };

  const reasoningPref = getReasoningEffortPreference(m.value);
  if (reasoningPref) {
    model.preferences = [reasoningPref];
  }

  return model;
}

/**
 * Fetches models from the Aimagicx API or returns static model list
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    const config = await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|aimagicx",
      includes: ['credentials'],
      useAsRunParams: true
    });
    const credentials = config.credentials;
    const api_key = credentials?.apiKey;
    let url = credentials?.baseUrl;
    if (url) {
      url = url.endsWith("/") ? url.slice(0, -1) : url;
    }

    await initRegistry();

    // If no API details provided, return static model list enriched with registry
    if (!url || !api_key) {
      return await Promise.all(aimagicx_models_data.map(enrichModel));
    }

    const response = await fetch(`${url}/models`, {
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Fallback to static models if API fails
      console.warn(
        `Aimagicx models API failed with status ${response.status}, using static models`,
      );
      return await Promise.all(aimagicx_models_data.map(enrichModel));
    }

    const data = await response.json();

    // Process API response and merge with registry + static data
    if (data.data && Array.isArray(data.data)) {
      return await Promise.all(data.data.map(async (apiModel: any) => {
        const modelId = apiModel.id || apiModel.value;
        const info = await getModel(modelId);
        const staticModel = aimagicx_models_data.find(
          (model) =>
            model.value === apiModel.id || model.value === apiModel.value,
        );

        const model: any = {
          value: modelId,
          title: apiModel.name || staticModel?.title || apiModel.id,
          context: info?.maxInputTokens || staticModel?.context || 8000,
          maxTokens: info?.maxOutputTokens || undefined,
          inputPrice: info?.inputPricePerMillion || 0,
          outputPrice: info?.outputPricePerMillion || 0,
          toolUse: info?.supportsToolUse ?? staticModel?.toolUse ?? false,
          visionEnable: info?.supportsVision ?? staticModel?.visionEnable ?? false,
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
    }

    // Fallback to static models if API response format is unexpected
    return await Promise.all(aimagicx_models_data.map(enrichModel));
  } catch (error) {
    console.error("Failed to fetch Aimagicx models:", error);
    // Return static models as fallback (without registry enrichment)
    return aimagicx_models_data.map((model) => ({
      value: model.value,
      title: model.title,
      context: model.context,
      toolUse: model.toolUse,
      visionEnable: model.visionEnable,
    }));
  }
}

/** Aimagicx models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Aimagicx model list
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

export { aimagicx_models_data };
