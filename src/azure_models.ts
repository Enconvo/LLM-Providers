import { ListCache, RequestOptions } from "@enconvo/api";
import { openai_models_data } from "./utils/openai_models_data.ts";
import { AzureOpenAI } from "openai";

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const credentials = options.credentials;
  console.log("credentials", credentials);

  const client = new AzureOpenAI({
    apiKey: options.credentials?.azureOpenAIApiKey,
    apiVersion: options.credentials?.azureOpenAIApiVersion,
    endpoint: options.credentials?.azureOpenAIApiEndpoint,
    deployment: options.modelName.value,
  });

  try {
    const resp = await client.models.list();
    console.log("respk11111", JSON.stringify(resp, null, 2));

    const data = resp.data;
    const result = data
      .map((item) => {
        if (item.id) {
          return item;
        }

        const model = openai_models_data.find(
          (model: any) => model.value === item.id,
        );

        const context = model?.context || 8000;
        const toolUse = model?.toolUse || false;
        const visionEnable = model?.visionEnable || false;
        const modelName = model?.value || item.id;

        const systemMessageEnable = !modelName.includes("o1-");

        return {
          ...model,
          title: model?.title || item.id,
          value: modelName,
          context: context,
          inputPrice: model?.inputPrice || 0,
          outputPrice: model?.outputPrice || 0,
          toolUse: toolUse,
          visionEnable: visionEnable,
          systemMessageEnable: systemMessageEnable,
        };
      })
      .filter((item: any) => {
        if (
          item.value.includes("embedding") ||
          item.value.includes("dall") ||
          item.value.includes("whisper") ||
          item.value.includes("babbage") ||
          item.value.includes("davinci") ||
          item.value.includes("audio") ||
          item.value.includes("realtime") ||
          item.value.includes("omni-moderation") ||
          item.value.includes("tts")
        ) {
          return false;
        }
        return true;
      });

    return result as ListCache.ListItem[];
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

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);

  return JSON.stringify(models);
}
