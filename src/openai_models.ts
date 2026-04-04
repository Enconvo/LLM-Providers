import { ListCache, RequestOptions } from "@enconvo/api";
import { openai_codex_models_data } from "./utils/openai_models_data.ts";
import { getModel, init as initRegistry } from "./utils/model_registry.ts";
import { getReasoningEffortPreference } from "./utils/reasoning_effort_data.ts";
import axios from "axios";

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
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const credentials = options.credentials;
  if (credentials?.credentials_type?.value === "oauth2") {
    return openai_codex_models_data;
  }

  let url = credentials?.baseUrl?.endsWith("/")
    ? credentials?.baseUrl
    : `${credentials?.baseUrl}/`;
  url = `${url}models`;

  if (!url || !credentials?.apiKey) {
    return [];
  }

  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${credentials?.apiKey}`,
    },
  });

  if (resp.status !== 200) {
    throw new Error(`API request failed with status ${resp.status}`);
  }

  // Ensure registry is loaded before the loop (single init, all lookups are in-memory after this)
  await initRegistry();

  const data = resp.data;
  const results = await Promise.all(
    data.data
      .filter((item: any) => {
        const id = item.value || item.id || "";
        return !NON_CHAT_KEYWORDS.some((kw) => id.includes(kw));
      })
      .map(async (item: any) => {
        if (item.value) return item;

        const modelId = item.value || item.id;
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

  return results;
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request) {
  const options = await req.json();

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);
  // console.log('models', models)

  return Response.json(models);
}
