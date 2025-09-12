import { ListCache, RequestOptions } from "@enconvo/api";

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  // console.log("fetchModels", url, api_key, type)
  try {
    if (!options.url || !options.api_key) {
      throw new Error("URL and API key are required");
    }
    const resp = await fetch(options.url, {
      headers: {
        Authorization: `Bearer ${options.api_key}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = await resp.json();
    const result = data.data
      .filter((item: any) => !item.id.includes("image"))
      .map((item: any) => {
        let context = 32768;
        let toolUse = true;
        let visionEnable = false;
        if (item.id.startsWith("grok-3")) {
          context = 131072;
        } else if (item.id.startsWith("grok-4")) {
          context = 256000;
          visionEnable = true;
        } else if (item.id.includes("vision")) {
          visionEnable = true;
        }

        return {
          title: item.id,
          value: item.id,
          context: context,
          inputPrice: item.inputPrice || 0,
          outputPrice: item.outputPrice || 0,
          toolUse: toolUse,
          visionEnable: visionEnable,
          visionImageCountLimit: 1,
          systemMessageEnable: true,
        };
      });

    // console.log("Total models fetched:", result)
    return result;
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
  options.api_key = options.credentials.apiKey;

  const url = `https://api.x.ai/v1/models`;
  options.url = url;

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);
  return JSON.stringify(models);
}
