import { ListCache, Preference, RequestOptions } from "@enconvo/api";


/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  if (!options.url || !options.api_key || !options.type) {
    return [];
  }
  try {
    const resp = await fetch(options.url, {
      headers: {
        Authorization: `Bearer ${options.api_key}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = await resp.json();
    const result = data.data[options.type].map((item: any): Preference.LLMModel => {
      const context = item.context || 8000;
      const visionEnable = item.metadata?.features?.includes("Image input") || false;
      const toolUse = false;
      const title = item.name || item.model;
      const value = item.model;
      const inputPrice = item.pricing?.coins || 0;
      const outputPrice = item.outputPrice || 0;
      const model: Preference.LLMModel = {
        type: "llm_model",
        title: title,
        value: value,
        context: context,
        maxTokens: item.max_output || 10000,
        inputPrice: inputPrice,
        outputPrice: outputPrice,
        perRequestPrice: item.pricing?.coins || 0,
        // @ts-ignore
        perRequestUnit: "100 words",
        toolUse: toolUse,
        visionEnable: visionEnable,
      };
      return model;
    });

    // console.log("Total models fetched:", result)
    return result;
  } catch (error) {
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
  const credentials = options.credentials;
  // console.log("credentials", credentials)

  options.url = "https://api.straico.com/v1/models";
  options.api_key = credentials.apiKey;
  options.type = options.type || "chat";

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);
  return JSON.stringify(models);
}
