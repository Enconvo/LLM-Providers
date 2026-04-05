import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import axios from "axios";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the Cerebras API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|cerebras",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  let url = credentials.baseUrl.endsWith("/")
    ? credentials.baseUrl
    : `${credentials.baseUrl}/`;
  url = `${url}models`;

  if (!url) {
    return [];
  }
  try {
    await initRegistry();

    // Using axios to make the API request
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    if (resp.status !== 200) {
      throw new Error(`
                url: ${url}
                API request failed with status ${resp.data}`);
    }

    const data = resp.data;
    const result = await Promise.all(data.data.map(async (item: any) => {
      const modelId = item.id;
      const info = await getModel(modelId);

      const context = info?.maxInputTokens || 8000;
      const visionEnable = info?.supportsVision || false;
      const toolUse = info?.supportsToolUse ?? true;
      const title = item.id;
      const value = item.id;
      const inputPrice = info?.inputPricePerMillion || 0;
      const outputPrice = info?.outputPricePerMillion || 0;

      const model: any = {
        title: title,
        value: value,
        context: context,
        maxTokens: info?.maxOutputTokens || undefined,
        inputPrice: inputPrice,
        outputPrice: outputPrice,
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
    console.error("Error fetching models:", error);
    return [];
  }
}

/** Cerebras models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Cerebras model list
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
