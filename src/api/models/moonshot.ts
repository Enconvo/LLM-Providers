import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the Moonshot API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|moonshot_ai",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const url = `${credentials.baseUrl}/models`;

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
    const result = await Promise.all(data.data.map(async (item: any) => {
      const modelId = item.id;
      const info = await getModel(modelId);

      // Fallback heuristics for context/vision/toolUse
      let fallbackContext = 131072;
      let fallbackVision = false;
      let fallbackToolUse = true;
      if (modelId.startsWith("kimi-k2-0711-preview")) {
        // defaults are fine
      } else if (modelId.startsWith("kimi-thinking-preview")) {
        fallbackVision = true;
        fallbackToolUse = false;
      } else if (modelId.startsWith("kimi-latest")) {
        fallbackVision = true;
      } else if (modelId.includes("-32k")) {
        fallbackContext = 32768;
      } else if (modelId.includes("-128k")) {
        fallbackContext = 131072;
      } else if (modelId.includes("-8k")) {
        fallbackContext = 8192;
      }

      if (modelId.includes("vision")) {
        fallbackVision = true;
      }

      const model: any = {
        title: modelId,
        value: modelId,
        context: info?.maxInputTokens || fallbackContext,
        maxTokens: info?.maxOutputTokens || undefined,
        inputPrice: info?.inputPricePerMillion || 0,
        outputPrice: info?.outputPricePerMillion || 0,
        toolUse: info?.supportsToolUse ?? fallbackToolUse,
        visionEnable: info?.supportsVision ?? fallbackVision,
        visionImageCountLimit: 1,
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

/** Moonshot models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Moonshot model list
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
