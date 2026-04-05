import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * Fetches models from the xAI API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|x_ai",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const url = `https://api.x.ai/v1/models`;

  // console.log("fetchModels", url, api_key, type)
  try {
    if (!credentials.apiKey) {
      throw new Error("API key is required");
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
    const result = await Promise.all(data.data
      .filter((item: any) => !item.id.includes("image"))
      .map(async (item: any) => {
        const modelId = item.id;
        const info = await getModel(modelId);

        // Fallback heuristics for context/vision if registry has no data
        let fallbackContext = 32768;
        let fallbackVision = false;
        if (modelId.startsWith("grok-3")) {
          fallbackContext = 131072;
        } else if (modelId.startsWith("grok-4")) {
          fallbackContext = 256000;
          fallbackVision = true;
        } else if (modelId.includes("vision")) {
          fallbackVision = true;
        }

        const model: any = {
          title: modelId,
          value: modelId,
          context: info?.maxInputTokens || fallbackContext,
          maxTokens: info?.maxOutputTokens || undefined,
          inputPrice: info?.inputPricePerMillion || 0,
          outputPrice: info?.outputPricePerMillion || 0,
          toolUse: info?.supportsToolUse ?? true,
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

/** xAI models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search xAI model list
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
