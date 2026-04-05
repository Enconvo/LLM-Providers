import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

// Groq models — only fields the registry doesn't have (providerName, speed, intelligence)
const groqModelsData = [
  { value: "llama-3.1-8b-instant", providerName: "Meta", speed: 5, intelligence: 3 },
  { value: "llama-3.3-70b-versatile", providerName: "Meta", speed: 4, intelligence: 4 },
  { value: "meta-llama/llama-guard-4-12b", providerName: "Meta", speed: 4, intelligence: 3 },
  { value: "deepseek-r1-distill-llama-70b", providerName: "DeepSeek / Meta", speed: 4, intelligence: 4 },
  { value: "meta-llama/llama-4-maverick-17b-128e-instruct", providerName: "Meta", speed: 4, intelligence: 4 },
  { value: "meta-llama/llama-4-scout-17b-16e-instruct", providerName: "Meta", speed: 4, intelligence: 4 },
  { value: "meta-llama/llama-prompt-guard-2-22m", providerName: "Meta", speed: 5, intelligence: 2 },
  { value: "meta-llama/llama-prompt-guard-2-86m", providerName: "Meta", speed: 5, intelligence: 2 },
  { value: "moonshotai/kimi-k2-instruct", providerName: "Moonshot AI", speed: 3, intelligence: 5 },
  { value: "openai/gpt-oss-120b", providerName: "OpenAI", speed: 4, intelligence: 4 },
  { value: "openai/gpt-oss-20b", providerName: "OpenAI", speed: 5, intelligence: 3 },
  { value: "qwen/qwen3-32b", providerName: "Alibaba Cloud", speed: 4, intelligence: 4 },
];

/**
 * Fetches models from the Groq API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|groq",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  try {
    let url = credentials.baseUrl.endsWith("/")
      ? credentials.baseUrl
      : `${credentials.baseUrl}/`;
    url = `${url}models`;

    if (!url || !credentials.apiKey) {
      throw new Error("URL and API key are required");
    }
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = await resp.json();

    // Ensure registry is loaded before the loop (single init, all lookups are in-memory after this)
    await initRegistry();

    // Filter out non-chat models (whisper, TTS, etc.)
    const results = await Promise.all(
      data.data
        .filter(
          (item: any) =>
            !item.id.includes("whisper") &&
            !item.id.includes("tts") &&
            !item.id.includes("distil-whisper"),
        )
        .map(async (item: any) => {
          const modelId = item.id;

          // Find matching local data for providerName, speed, intelligence
          const localData = groqModelsData.find(
            (model) =>
              model.value === modelId ||
              modelId.includes(model.value) ||
              model.value.includes(modelId),
          );

          // Look up registry for context/pricing/capabilities
          const info = await getModel(modelId);
          const reasoningPref = getReasoningEffortPreference(modelId);

          // Determine capabilities based on model name (fallbacks if registry has no data)
          const visionEnable =
            info?.supportsVision ?? (modelId.includes("vision") || modelId.includes("llava"));
          const toolUse =
            info?.supportsToolUse ?? (modelId.includes("tool-use") || !modelId.includes("guard"));

          return {
            type: "llm_model",
            title: localData?.providerName
              ? `${localData.providerName} - ${modelId}`
              : modelId,
            value: modelId,
            context: info?.maxInputTokens ?? item.context_window ?? 8192,
            maxTokens: info?.maxOutputTokens ?? item.max_completion_tokens ?? 8192,
            inputPrice: info?.inputPricePerMillion ?? 0,
            outputPrice: info?.outputPricePerMillion ?? 0,
            toolUse: toolUse,
            visionEnable: visionEnable,
            audioEnable: info?.supportsAudioInput ?? false,
            videoEnable: info?.supportsVideoInput ?? false,
            visionImageCountLimit: 1,
            systemMessageEnable: info?.supportsSystemMessages ?? !visionEnable,
            speed: localData?.speed ?? 3,
            intelligence: localData?.intelligence ?? 3,
            ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
          };
        }),
    );

    return results;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** Groq models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Groq model list
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
