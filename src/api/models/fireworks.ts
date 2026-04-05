import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the Fireworks API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|fireworks",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const baseUrl = credentials.baseUrl.endsWith("/")
    ? credentials.baseUrl
    : `${credentials.baseUrl}/`;
  const url = `${baseUrl}models`;

  // console.log("fetchModels", url, api_key, type)
  try {
    if (!url || !credentials.apiKey) {
      throw new Error("URL and API key are required");
    }

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
    console.log("fireworks_models data", JSON.stringify(data.data, null, 2));
    const result = await Promise.all(data.data
      .filter((item: any) => !item.id.includes("whisper"))
      .map(async (item: any) => {
        const modelId = item.value || item.id;
        const info = await getModel(modelId);

        const context = item.context_length || info?.maxInputTokens || 8000;
        const visionEnable = item.supports_image_input || info?.supportsVision || false;
        const toolUse = item.supports_tools || info?.supportsToolUse || false;

        const model: any = {
          title: item.title || item.id,
          value: modelId,
          context: context,
          maxTokens: info?.maxOutputTokens || undefined,
          inputPrice: info?.inputPricePerMillion || 0,
          outputPrice: info?.outputPricePerMillion || 0,
          toolUse: toolUse,
          visionEnable: visionEnable,
          visionImageCountLimit: 1,
          systemMessageEnable: info?.supportsSystemMessages ?? !visionEnable,
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

/** Fireworks models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Fireworks model list
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
