import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import axios from "axios";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";


interface FetchedModel {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
    web_search: string;
    internal_reasoning: string;
    input_cache_read: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  per_request_limits: any | null;
  supported_parameters: string[];
  default_parameters: {
    temperature: number | null;
    top_p: number | null;
    frequency_penalty: number | null;
  };
}

/**
 * Fetches models from the OpenRouter API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|openrouter",
    includes: ['credentials'],
    useAsRunParams: true
  });

  const url = "https://openrouter.ai/api/v1/models";

  try {
    await initRegistry();

    // Using axios to fetch data from the API
    const resp = await axios.get(url);

    if (resp.status !== 200) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = resp.data.data;
    console.log("data", JSON.stringify(data.filter((model: any) => model.id.includes('flash')), null, 2));
    const models = await Promise.all(data.map(async (model: FetchedModel) => {
      const modelId = model.id;
      const info = await getModel(modelId);

      const visionEnable = model.architecture.input_modalities.includes("image") || info?.supportsVision || false;
      const audioEnable = model.architecture.input_modalities.includes("audio") || info?.supportsAudioInput || false;
      const videoEnable = model.architecture.input_modalities.includes("video") || info?.supportsVideoInput || false;

      const imageGenerationEnable = model.architecture.output_modalities.includes("image");
      const audioGenerationEnable = model.architecture.output_modalities.includes("audio");
      const toolUse = model.supported_parameters.includes("tools") || info?.supportsToolUse || false;

      const llmModel: Preference.LLMModel & { preferences?: any[] } = {
        type: "llm_model",
        title: model.name,
        value: modelId,
        context: model.context_length || info?.maxInputTokens || 128000,
        maxTokens: info?.maxOutputTokens || undefined,
        inputPrice: parseFloat(model.pricing.prompt) * 1000000 || info?.inputPricePerMillion || 0,
        outputPrice: parseFloat(model.pricing.completion) * 1000000 || info?.outputPricePerMillion || 0,
        toolUse: toolUse,
        visionEnable: visionEnable,
        imageGeneration: imageGenerationEnable,
        audioEnable: audioEnable,
        videoEnable: videoEnable,
        audioGeneration: audioGenerationEnable,
        systemMessageEnable: info?.supportsSystemMessages ?? true,
      };

      const reasoningPref = getReasoningEffortPreference(modelId);
      if (reasoningPref) {
        llmModel.preferences = [reasoningPref];
      }

      return llmModel;
    }));

    // console.log("Total models fetched:", result)
    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** OpenRouter models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search OpenRouter model list
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
