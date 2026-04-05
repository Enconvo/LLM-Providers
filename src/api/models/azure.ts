import { CommandManageUtils, ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { getModel, init as initRegistry } from "../../utils/model_registry.ts";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";
import { AzureOpenAI } from "openai";

const NON_CHAT_KEYWORDS = [
  "embedding",
  "dall",
  "whisper",
  "babbage",
  "davinci",
  "audio",
  "realtime",
  "omni-moderation",
  "tts",
];

/**
 * Fetches models from the Azure OpenAI API
 */
async function fetchModels(
  _options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|azure_openai",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const client = new AzureOpenAI({
    apiKey: credentials?.azureOpenAIApiKey,
    apiVersion: credentials?.azureOpenAIApiVersion,
    endpoint: credentials?.azureOpenAIApiEndpoint,
    deployment: credentials?.modelName?.value,
  });

  try {
    const resp = await client.models.list();
    console.log("respk11111", JSON.stringify(resp, null, 2));

    const data = resp.data;

    // Ensure registry is loaded before the loop (single init, all lookups are in-memory after this)
    await initRegistry();

    const results = await Promise.all(
      data
        .filter((item: any) => {
          const id = item.id || "";
          return !NON_CHAT_KEYWORDS.some((kw) => id.includes(kw));
        })
        .map(async (item) => {
          const modelId = item.id;
          const info = await getModel(modelId);
          const reasoningPref = getReasoningEffortPreference(modelId);

          return {
            type: "llm_model",
            title: item.id,
            value: modelId,
            context: info?.maxInputTokens ?? 8000,
            maxTokens: info?.maxOutputTokens ?? undefined,
            inputPrice: info?.inputPricePerMillion ?? 0,
            outputPrice: info?.outputPricePerMillion ?? 0,
            toolUse: info?.supportsToolUse ?? false,
            visionEnable: info?.supportsVision ?? false,
            audioEnable: info?.supportsAudioInput ?? false,
            videoEnable: info?.supportsVideoInput ?? false,
            systemMessageEnable: info?.supportsSystemMessages ?? true,
            ...(reasoningPref ? { preferences: [reasoningPref] } : {}),
          };
        }),
    );

    return results as ListCache.ListItem[];
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** Azure OpenAI models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Azure OpenAI model list
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
