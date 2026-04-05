import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

/**
 * 1min AI models data with capabilities and context limits
 */
const minai_models_data = [
  // Alibaba Models
  {
    value: "qwen3-max",
    title: "Qwen3 Max",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "qwen-plus",
    title: "Qwen Plus",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "qwen-max",
    title: "Qwen Max",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "qwen-flash",
    title: "Qwen Flash",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },

  // Anthropic Models
  {
    value: "claude-sonnet-4-5-20250929",
    title: "Claude Sonnet 4.5",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-sonnet-4-20250514",
    title: "Claude Sonnet 4",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-opus-4-5-20251101",
    title: "Claude Opus 4.5",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-opus-4-20250514",
    title: "Claude Opus 4",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-opus-4-1-20250805",
    title: "Claude Opus 4.1",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "claude-haiku-4-5-20251001",
    title: "Claude Haiku 4.5",
    context: 200000,
    toolUse: true,
    visionEnable: true,
  },

  // Cohere Models
  {
    value: "command-r-08-2024",
    title: "Command R (08-2024)",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },

  // DeepSeek Models
  {
    value: "deepseek-reasoner",
    title: "DeepSeek V3.2 Reasoner",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "deepseek-chat",
    title: "DeepSeek V3.2 Chat",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },

  // Google AI Models
  {
    value: "gemini-3-pro-preview",
    title: "Gemini 3 Pro Preview",
    context: 1048576,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gemini-2.5-pro",
    title: "Gemini 2.5 Pro",
    context: 1048576,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gemini-2.5-flash",
    title: "Gemini 2.5 Flash",
    context: 1048576,
    toolUse: true,
    visionEnable: true,
  },

  // Mistral Models
  {
    value: "magistral-small-latest",
    title: "Magistral Small 1.2",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "magistral-medium-latest",
    title: "Magistral Medium 1.2",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "ministral-14b-latest",
    title: "Ministral 14B Latest",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "open-mistral-nemo",
    title: "Mistral Open Nemo",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "mistral-small-latest",
    title: "Mistral Small",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "mistral-medium-latest",
    title: "Mistral Medium 3.1",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "mistral-large-latest",
    title: "Mistral Large 2",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },

  // OpenAI Models
  {
    value: "gpt-5.1-codex-mini",
    title: "GPT-5.1 Codex Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5.1-codex",
    title: "GPT-5.1 Codex",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "o4-mini",
    title: "GPT-o4 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "o3-mini",
    title: "GPT-o3 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "gpt-5.2-pro",
    title: "GPT-5.2 Pro",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5.2",
    title: "GPT-5.2",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5.1",
    title: "GPT-5.1",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5-nano",
    title: "GPT-5 Nano",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5-mini",
    title: "GPT-5 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5-chat-latest",
    title: "GPT-5 Chat Latest",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-5",
    title: "GPT-5",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4o-mini",
    title: "GPT-4o Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4o",
    title: "GPT-4o",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4.1-nano",
    title: "GPT-4.1 Nano",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4.1-mini",
    title: "GPT-4.1 Mini",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4.1",
    title: "GPT-4.1",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-4-turbo",
    title: "GPT-4 Turbo",
    context: 128000,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "gpt-3.5-turbo",
    title: "GPT-3.5 Turbo",
    context: 16385,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "o4-mini-deep-research",
    title: "o4 Mini Deep Research",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "o3-pro",
    title: "o3 Pro",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "o3-deep-research",
    title: "o3 Deep Research",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "o3",
    title: "o3",
    context: 128000,
    toolUse: true,
    visionEnable: false,
  },

  // Perplexity Models
  {
    value: "sonar-reasoning-pro",
    title: "Perplexity Sonar Reasoning Pro",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "sonar-pro",
    title: "Perplexity Sonar Pro",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "sonar-deep-research",
    title: "Perplexity Sonar Deep Research",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "sonar",
    title: "Perplexity Sonar",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },

  // xAI Models
  {
    value: "grok-4-fast-reasoning",
    title: "Grok 4 Fast Reasoning",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "grok-4-fast-non-reasoning",
    title: "Grok 4 Fast Non-Reasoning",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "grok-4-0709",
    title: "Grok 4",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "grok-3-mini",
    title: "Grok 3 Mini",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },
  {
    value: "grok-3",
    title: "Grok 3",
    context: 131072,
    toolUse: true,
    visionEnable: true,
  },

  // Meta Models
  {
    value: "meta/meta-llama-3.1-405b-instruct",
    title: "LLaMA 3.1 405B",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "meta/meta-llama-3-70b-instruct",
    title: "LLaMA 3 70B",
    context: 8192,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "meta/llama-4-scout-instruct",
    title: "LLaMA 4 Scout Instruct",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "meta/llama-4-maverick-instruct",
    title: "LLaMA 4 Maverick Instruct",
    context: 131072,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "meta/llama-2-70b-chat",
    title: "LLaMA 2 70B Chat",
    context: 4096,
    toolUse: false,
    visionEnable: false,
  },

  // OpenAI Open Source Models
  {
    value: "openai/gpt-oss-20b",
    title: "GPT OSS 20B",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },
  {
    value: "openai/gpt-oss-120b",
    title: "GPT OSS 120B",
    context: 32768,
    toolUse: true,
    visionEnable: false,
  },
];

/**
 * Enrich a static model entry with registry data
 */
async function enrichModel(m: typeof minai_models_data[number]) {
  const info = await getModel(m.value);

  const model: any = {
    value: m.value,
    title: m.title,
    context: info?.maxInputTokens || m.context,
    maxTokens: info?.maxOutputTokens || undefined,
    inputPrice: info?.inputPricePerMillion || 0,
    outputPrice: info?.outputPricePerMillion || 0,
    toolUse: info?.supportsToolUse ?? m.toolUse,
    visionEnable: info?.supportsVision ?? m.visionEnable,
    systemMessageEnable: info?.supportsSystemMessages ?? true,
    audioEnable: info?.supportsAudioInput || false,
    videoEnable: info?.supportsVideoInput || false,
  };

  const reasoningPref = getReasoningEffortPreference(m.value);
  if (reasoningPref) {
    model.preferences = [reasoningPref];
  }

  return model;
}

/**
 * Fetches models from the 1min AI static model list
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  try {
    await CommandManageUtils.loadCommandConfig({
      commandKey: "llm|1minai",
      includes: ['credentials'],
      useAsRunParams: true
    });
    await initRegistry();

    // 1min AI doesn't have a standard /models endpoint like OpenAI
    // We'll use the static model list as they don't provide a dynamic model list endpoint
    // The documentation shows fixed models available on their platform

    return await Promise.all(minai_models_data.map(enrichModel));
  } catch (error) {
    console.error("Failed to fetch 1min AI models:", error);
    // Return static models as fallback (without registry enrichment)
    return minai_models_data.map((model) => ({
      value: model.value,
      title: model.title,
      context: model.context,
      toolUse: model.toolUse,
      visionEnable: model.visionEnable,
    }));
  }
}

/** 1min AI models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search 1min AI model list
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

export { minai_models_data };
