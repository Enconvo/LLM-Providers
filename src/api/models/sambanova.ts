import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

const models: { title: string; value: string; context: number }[] = [
  {
    title: "DeepSeek-R1-Distill-Llama-70B",
    value: "DeepSeek-R1-Distill-Llama-70B",
    context: 64000,
  },
  {
    title: "DeepSeek-R1",
    value: "DeepSeek-R1",
    context: 64000,
  },
  {
    title: "Llama-3.1-Tulu-3-405B",
    value: "Llama-3.1-Tulu-3-405B",
    context: 16384,
  },
  {
    title: "Qwen2.5 Coder 32B",
    value: "Qwen2.5-Coder-32B-Instruct",
    context: 8192,
  },
  {
    title: "Qwen2.5 72B",
    value: "Qwen2.5-72B-Instruct",
    context: 8192,
  },
  {
    title: "QwQ 32B Preview",
    value: "QwQ-32B-Preview",
    context: 8192,
  },
  {
    title: "Llama 3.3 70B",
    value: "Meta-Llama-3.3-70B-Instruct",
    context: 4096,
  },
  {
    title: "Llama-3.2-11B-Vision-Instruct",
    value: "Llama-3.2-11B-Vision-Instruct",
    context: 4096,
  },
  {
    title: "Llama-3.2-90B-Vision-Instruct",
    value: "Llama-3.2-90B-Vision-Instruct",
    context: 4096,
  },
  {
    title: "Llama 3.2 1B",
    value: "Meta-Llama-3.2-1B-Instruct",
    context: 16384,
  },
  {
    title: "Llama 3.2 3B",
    value: "Meta-Llama-3.2-3B-Instruct",
    context: 4096,
  },
  {
    title: "Llama 3.2 11B",
    value: "Llama-3.2-11B-Vision-Instruct",
    context: 4096,
  },
  {
    title: "Llama 3.2 90B",
    value: "Llama-3.2-90B-Vision-Instruct",
    context: 4096,
  },
  {
    title: "Llama 3.1 8B",
    value: "Meta-Llama-3.1-8B-Instruct",
    context: 16384,
  },
  {
    title: "Llama 3.1 70B",
    value: "Meta-Llama-3.1-70B-Instruct",
    context: 131072,
  },
  {
    title: "Llama 3.1 405B",
    value: "Meta-Llama-3.1-405B-Instruct",
    context: 16384,
  },
  {
    title: "Llama Guard 3 8B",
    value: "Meta-Llama-Guard-3-8B",
    context: 8192,
  },
];

/**
 * Fetches models from the SambaNova static model list
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|sambanova",
      includes: ['credentials'],
      useAsRunParams: true
    });
    await initRegistry();

    const result = await Promise.all(models.map(async (m) => {
      const info = await getModel(m.value);

      const model: any = {
        title: m.title,
        value: m.value,
        context: info?.maxInputTokens || m.context,
        maxTokens: info?.maxOutputTokens || undefined,
        inputPrice: info?.inputPricePerMillion || 0,
        outputPrice: info?.outputPricePerMillion || 0,
        toolUse: info?.supportsToolUse || false,
        visionEnable: info?.supportsVision || m.value.toLowerCase().includes("vision"),
        systemMessageEnable: info?.supportsSystemMessages ?? true,
        audioEnable: info?.supportsAudioInput || false,
        videoEnable: info?.supportsVideoInput || false,
      };

      const reasoningPref = getReasoningEffortPreference(m.value);
      if (reasoningPref) {
        model.preferences = [reasoningPref];
      }

      return model;
    }));

    return result;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** SambaNova models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search SambaNova model list
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
