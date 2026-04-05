import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { GoogleGenAI } from "@google/genai";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

// ---------------------------------------------------------------------------
// Gemini model-specific data (fields the registry does NOT provide).
//
// Registry supplies: context, maxTokens, inputPrice, outputPrice, toolUse,
//                    visionEnable, audioEnable.
// We keep:           speed, intelligence, reasoning, searchToolSupported,
//                    imageGeneration, type.
// ---------------------------------------------------------------------------

interface GeminiModelMeta {
  title: string;
  value: string;
  speed: number;
  intelligence: number;
  reasoning?: number;
  type: string;
  searchToolSupported?: boolean;
  imageGeneration?: boolean;
}

const geminiModelsMeta: GeminiModelMeta[] = [
  {
    title: "Gemini 3.1 Flash-Lite Preview",
    value: "gemini-3.1-flash-lite-preview",
    speed: 5,
    intelligence: 3,
    reasoning: 3,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 3.1 Pro Preview",
    value: "gemini-3.1-pro-preview",
    speed: 3,
    intelligence: 5,
    reasoning: 5,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 3 Pro Preview",
    value: "gemini-3-pro-preview",
    speed: 3,
    intelligence: 5,
    reasoning: 5,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 3 Flash Preview",
    value: "gemini-3-flash-preview",
    speed: 4,
    intelligence: 4,
    reasoning: 4,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 2.5 Pro",
    value: "gemini-2.5-pro",
    speed: 3,
    intelligence: 5,
    reasoning: 5,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 2.5 Flash",
    value: "gemini-2.5-flash",
    speed: 4,
    intelligence: 4,
    reasoning: 4,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 2.5 Flash Image Preview",
    value: "gemini-2.5-flash-image-preview",
    speed: 5,
    intelligence: 3,
    reasoning: 0,
    type: "llm_model",
    imageGeneration: true,
  },
  {
    title: "Gemini 3 Pro Image Preview",
    value: "gemini-3-pro-image-preview",
    speed: 5,
    intelligence: 3,
    reasoning: 0,
    type: "llm_model",
    imageGeneration: true,
  },
  {
    title: "Gemini 2.5 Flash-Lite",
    value: "gemini-2.5-flash-lite",
    speed: 5,
    intelligence: 3,
    reasoning: 3,
    type: "llm_model",
    searchToolSupported: true,
  },
  {
    title: "Gemini 2.0 Flash",
    value: "gemini-2.0-flash",
    speed: 4,
    intelligence: 4,
    type: "llm_model",
  },
  {
    title: "Gemini 2.0 Flash-Lite",
    value: "gemini-2.0-flash-lite",
    speed: 5,
    intelligence: 3,
    type: "llm_model",
  },
  {
    title: "Gemini 1.5 Pro",
    value: "gemini-1.5-pro",
    speed: 3,
    intelligence: 5,
    type: "llm_model",
  },
  {
    title: "Gemini 1.5 Flash",
    value: "gemini-1.5-flash",
    speed: 4,
    intelligence: 4,
    type: "llm_model",
  },
  {
    title: "Gemini 1.5 Flash-8B",
    value: "gemini-1.5-flash-8b",
    speed: 5,
    intelligence: 3,
    type: "llm_model",
  },
];

// ---------------------------------------------------------------------------
// Build full LLMModel entries by merging model-specific meta with registry
// data and reasoning effort preferences.
// ---------------------------------------------------------------------------

async function buildGeminiModelsData(): Promise<Preference.LLMModel[]> {
  await initRegistry();

  const results: Preference.LLMModel[] = [];

  for (const meta of geminiModelsMeta) {
    const info = await getModel(meta.value);
    const reasoningPref = getReasoningEffortPreference(meta.value);

    const model: Preference.LLMModel = {
      title: meta.title,
      value: meta.value,
      context: info?.maxInputTokens ?? 1000000,
      maxTokens: info?.maxOutputTokens ?? 8192,
      inputPrice: info?.inputPricePerMillion ?? 0,
      outputPrice: info?.outputPricePerMillion ?? 0,
      toolUse: info?.supportsToolUse ?? true,
      visionEnable: info?.supportsVision ?? true,
      audioEnable: info?.supportsAudioInput ?? false,
      speed: meta.speed,
      intelligence: meta.intelligence,
      reasoning: meta.reasoning,
      type: meta.type as "llm_model",
      searchToolSupported: meta.searchToolSupported,
      imageGeneration: meta.imageGeneration,
      ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
    };

    results.push(model);
  }

  return results;
}

// Exported so other modules can still import the data.
// The first call builds and caches the array; subsequent calls return the cached version.
let _cachedModelsData: Preference.LLMModel[] | null = null;

export async function getGeminiModelsData(): Promise<Preference.LLMModel[]> {
  if (!_cachedModelsData) {
    _cachedModelsData = await buildGeminiModelsData();
  }
  return _cachedModelsData;
}

// Keep a synchronous export for backward compatibility with any code that
// directly imports geminiModelsData. It starts empty and is populated after
// the first async build.
export let geminiModelsData: Preference.LLMModel[] = [];

/**
 * Fetches models from the Gemini API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|gemini",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;
  const credentialsType = credentials?.credentials_type?.value || 'apiKey'

  // Ensure registry + reasoning data are ready
  await initRegistry();

  if (credentialsType === 'oauth2') {
    // Reuse the single source of truth instead of duplicating
    const models = await getGeminiModelsData();
    geminiModelsData = models;
    return models;
  }

  try {
    const google = new GoogleGenAI({ apiKey: credentials?.apiKey });
    const pager = await google.models.list();
    const models: ListCache.ListItem[] = [];

    // Build the meta lookup once
    const modelsData = await getGeminiModelsData();
    geminiModelsData = modelsData;

    for await (const model of pager) {
      // Check if model supports content generation
      if (
        model.supportedActions?.some(
          (action) =>
            action === "generateContent" || action === "bidiGenerateContent",
        )
      ) {
        // Skip deprecated and unsupported models
        const isGemini15 = model.name?.includes("gemini-1.5");
        const isGemini10 = model.name?.includes("gemini-1.0");
        const isDeprecatedModel = model.name?.includes("gemini-pro-vision");

        if (isGemini15 || isGemini10 || isDeprecatedModel) {
          continue;
        }

        // Identify special model types
        const isThinking = model.name?.includes("thinking");
        const isTTS = model.name?.includes("tts");
        const isEmbedding = model.name?.includes("embedding");

        if (isEmbedding) {
          continue;
        }

        const modelId = model.name?.replace("models/", "") || "";

        // Look up registry data for this model
        const info = await getModel(modelId);
        const reasoningPref = getReasoningEffortPreference(modelId);

        // Find matching model-specific meta or use defaults
        const modelMeta = geminiModelsMeta.find(
          (data) => modelId === data.value,
        ) || {
          speed: 4,
          intelligence: 3,
          imageGeneration: false,
          type: "llm_model",
        };

        models.push({
          title: model.displayName || modelId,
          value: modelId,
          context: info?.maxInputTokens ?? model.inputTokenLimit ?? 1000000,
          maxTokens: info?.maxOutputTokens ?? model.outputTokenLimit ?? 8192,
          visionEnable: info?.supportsVision ?? true,
          audioEnable: info?.supportsAudioInput ?? true,
          imageGeneration: modelMeta.imageGeneration || false,
          audioGeneration: isTTS || false,
          systemMessageEnable: info?.supportsSystemMessages ?? true,
          toolUse: info?.supportsToolUse ?? !isThinking,
          inputPrice: info?.inputPricePerMillion ?? 0,
          outputPrice: info?.outputPricePerMillion ?? 0,
          speed: modelMeta.speed || 4,
          intelligence: modelMeta.intelligence || 3,
          ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
        });
      }
    }

    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** Gemini models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Gemini model list
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
