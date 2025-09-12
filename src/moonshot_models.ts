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
    const result = data.data.map((item: any) => {
      let context = 131072;
      let toolUse = true;
      let visionEnable = false;
      if (item.id.startsWith("kimi-k2-0711-preview")) {
      } else if (item.id.startsWith("kimi-thinking-preview")) {
        visionEnable = true;
        toolUse = false;
      } else if (item.id.startsWith("kimi-latest")) {
        visionEnable = true;
      } else if (item.id.includes("-32k")) {
        context = 32768;
      } else if (item.id.includes("-128k")) {
        context = 131072;
      } else if (item.id.includes("-8k")) {
        context = 8192;
      }

      if (item.id.includes("vision")) {
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

  const url = `${options.credentials.baseUrl}/models`;
  options.url = url;
  console.log("url", url);

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);
  return JSON.stringify(models);
}
