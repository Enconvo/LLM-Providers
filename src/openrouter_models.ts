import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import axios from "axios";


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
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    // Using axios to fetch data from the API
    const resp = await axios.get(options.url);

    if (resp.status !== 200) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = resp.data.data;
    console.log("data", JSON.stringify(data.filter((model: any) => model.id.includes('flash')), null, 2));
    const models = data.map((model: FetchedModel) => {
      const visionEnable = model.architecture.input_modalities.includes("image");
      const audioEnable = model.architecture.input_modalities.includes("audio");
      const videoEnable = model.architecture.input_modalities.includes("video");

      const imageGenerationEnable = model.architecture.output_modalities.includes("image");
      const audioGenerationEnable = model.architecture.output_modalities.includes("audio");
      const toolUse = model.supported_parameters.includes("tools")

      const llmModel: Preference.LLMModel = {
        type: "llm_model",
        title: model.name,
        value: model.id,
        context: model.context_length,
        inputPrice: parseFloat(model.pricing.prompt) * 1000000,
        outputPrice: parseFloat(model.pricing.completion) * 1000000,
        toolUse: toolUse,
        visionEnable: visionEnable,
        imageGeneration: imageGenerationEnable,
        audioEnable: audioEnable,
        videoEnable: videoEnable,
        audioGeneration: audioGenerationEnable,
      };
      return llmModel;
    });

    // console.log("Total models fetched:", result)
    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
  const options = await req.json();
  options.api_key = options.apiKey;

  options.url = "https://openrouter.ai/api/v1/models";

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);

  return JSON.stringify(models);
}
