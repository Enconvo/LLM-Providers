import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// Speed / Intelligence / Search-tool heuristics (not in registry)
// ============================================================================

interface ModelTraits {
  speed: number;        // 1-5, 5 = fastest
  intelligence: number; // 1-5, 5 = highest
  searchToolSupported: boolean;
}

/** First matching prefix wins — order from most-specific to least-specific. */
const traitRules: { prefix: string; traits: ModelTraits }[] = [
  { prefix: "claude-opus-4-1",  traits: { speed: 3, intelligence: 5, searchToolSupported: true } },
  { prefix: "claude-opus-4",    traits: { speed: 3, intelligence: 5, searchToolSupported: true } },
  { prefix: "claude-sonnet-4",  traits: { speed: 4, intelligence: 4, searchToolSupported: true } },
  { prefix: "claude-3-7-sonnet",traits: { speed: 4, intelligence: 4, searchToolSupported: true } },
  { prefix: "claude-3-5-sonnet",traits: { speed: 4, intelligence: 4, searchToolSupported: true } },
  { prefix: "claude-3-5-haiku", traits: { speed: 5, intelligence: 3, searchToolSupported: true } },
  { prefix: "claude-3-opus",    traits: { speed: 3, intelligence: 4, searchToolSupported: false } },
  { prefix: "claude-3-haiku",   traits: { speed: 4, intelligence: 2, searchToolSupported: false } },
];

function getTraits(modelId: string): ModelTraits {
  for (const rule of traitRules) {
    if (modelId.includes(rule.prefix)) return rule.traits;
  }
  // Sensible defaults for unknown Claude models
  return { speed: 3, intelligence: 3, searchToolSupported: false };
}

/**
 * Fetches models from the Anthropic API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|anthropic",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const credentialsType = credentials?.credentials_type?.value;

  if (credentialsType === "oauth2" && !credentials?.access_token) {
    return [];
  }

  if (credentialsType === "apiKey" && !credentials?.anthropicApiKey && !credentials?.apiKey) {
    return [];
  }

  const anthropic = new Anthropic({
    apiKey: credentials?.anthropicApiKey || credentials?.apiKey,
    authToken: credentials?.access_token,
    baseURL: credentials?.anthropicApiUrl || credentials?.baseUrl,
    defaultHeaders:
      credentialsType === "oauth2"
        ? {
          "anthropic-beta":
            "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        }
        : {},
  });

  // Ensure registry is loaded before the loop (single init, all lookups are in-memory after this)
  await initRegistry();

  const models = await anthropic.models.list();
  // console.log("anthropic models", models)

  let result: Preference.ListItem[] = [];
  for await (const page of models.iterPages()) {
    const items = await Promise.all(
      page.data.map(async (item) => {
        const info = await getModel(item.id);
        const traits = getTraits(item.id);
        const reasoningPref = getReasoningEffortPreference(item.id);

        const model: Preference.LLMModel = {
          type: "llm_model",
          title: item.display_name,
          providerName: "anthropic",
          value: item.id,
          context: info?.maxInputTokens ?? 200000,
          maxTokens: info?.maxOutputTokens ?? 32000,
          inputPrice: info?.inputPricePerMillion ?? 1,
          outputPrice: info?.outputPricePerMillion ?? 1,
          speed: traits.speed,
          intelligence: traits.intelligence,
          toolUse: info?.supportsToolUse ?? true,
          visionEnable: info?.supportsVision ?? true,
          searchToolSupported: traits.searchToolSupported,
          ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
        };
        return model;
      }),
    );

    result.push(...items);
  }

  return result;
}

/** Anthropic models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Anthropic model list
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
