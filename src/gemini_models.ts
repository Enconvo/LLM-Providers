import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import { GoogleGenAI } from "@google/genai";

// Gemini models pricing and configuration data
export const geminiModelsData: Preference.LLMModel[] = [
  // Gemini 2.5 Pro - State-of-the-art multipurpose model
  {
    title: "Gemini 2.5 Pro",
    value: "gemini-2.5-pro",
    inputPrice: 1.25, // prompts <= 200k tokens
    context: 200000,
    maxTokens: 200000,
    outputPrice: 10.0,
    speed: 3,
    intelligence: 5,
    reasoning: 5,
    type: "llm_model",
    searchToolSupported: true,
    toolUse: true,
    visionEnable: true,
  },
  // Gemini 2.5 Flash - Hybrid reasoning model with 1M token context
  {
    title: "Gemini 2.5 Flash",
    value: "gemini-2.5-flash",
    inputPrice: 0.3, // text/image/video
    context: 1000000,
    maxTokens: 1000000,
    outputPrice: 2.5,
    speed: 4,
    intelligence: 4,
    reasoning: 4,
    type: "llm_model",
    searchToolSupported: true,
    toolUse: true,
    visionEnable: true,
  },
  {
    title: "Gemini 2.5 Flash Image Preview",
    value: "gemini-2.5-flash-image-preview",
    context: 32768,
    maxTokens: 32768,
    inputPrice: 100,
    outputPrice: 0.4,
    speed: 5,
    intelligence: 3,
    reasoning: 0,
    visionEnable: true,
    imageGeneration: true,
    audioEnable: false,
    toolUse: false,
    type: "llm_model",
  },
  {
    title: "Gemini 3 Pro Image Preview",
    value: "gemini-3-pro-image-preview",
    context: 32768,
    maxTokens: 32768,
    inputPrice: 100,
    outputPrice: 0.4,
    speed: 5,
    intelligence: 3,
    reasoning: 0,
    visionEnable: true,
    imageGeneration: true,
    audioEnable: false,
    toolUse: false,
    type: "llm_model",
  },
  // Gemini 2.5 Flash-Lite - Most cost effective model
  {
    title: "Gemini 2.5 Flash-Lite",
    value: "gemini-2.5-flash-lite",
    context: 1048576,
    maxTokens: 1048576,
    inputPrice: 0.1, // text/image/video
    outputPrice: 0.4,
    speed: 5,
    intelligence: 3,
    reasoning: 3,
    type: "llm_model",
    searchToolSupported: true,
    toolUse: true,
    visionEnable: true,
  },
  // Gemini 2.0 Flash - Balanced multimodal model for Agents era
  {
    title: "Gemini 2.0 Flash",
    value: "gemini-2.0-flash",
    inputPrice: 0.1, // text/image/video
    outputPrice: 0.4,
    speed: 4,
    intelligence: 4,
    type: "llm_model",
  },
  // Gemini 2.0 Flash-Lite - Smallest and most cost effective
  {
    title: "Gemini 2.0 Flash-Lite",
    value: "gemini-2.0-flash-lite",
    inputPrice: 0.075,
    outputPrice: 0.3,
    speed: 5,
    intelligence: 3,
    type: "llm_model",
  },
  // Gemini 1.5 Pro - Highest intelligence with 2M token context
  {
    title: "Gemini 1.5 Pro",
    value: "gemini-1.5-pro",
    inputPrice: 1.25, // prompts <= 128k tokens
    outputPrice: 5.0,
    speed: 3,
    intelligence: 5,
    type: "llm_model",
  },
  // Gemini 1.5 Flash - Fastest multimodal with 1M token context
  {
    title: "Gemini 1.5 Flash",
    value: "gemini-1.5-flash",
    inputPrice: 0.075, // prompts <= 128k tokens
    outputPrice: 0.3,
    speed: 4,
    intelligence: 4,
    type: "llm_model",
  },
  // Gemini 1.5 Flash-8B - Smallest model for lower intelligence tasks
  {
    title: "Gemini 1.5 Flash-8B",
    value: "gemini-1.5-flash-8b",
    inputPrice: 0.0375, // prompts <= 128k tokens
    outputPrice: 0.15,
    speed: 5,
    intelligence: 3,
    type: "llm_model",
  },
];

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param options - Request options containing API key and other parameters
 * @returns Promise<ListCache.ListItem[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {

  const credentials = options.credentials;
  const credentialsType = credentials?.credentials_type?.value || 'apiKey'
  if (credentialsType === 'oauth2') {
    return [
      {
        title: "Gemini 3 Pro Preview",
        value: "gemini-3-pro-preview",
        inputPrice: 1.25, // prompts <= 200k tokens
        context: 200000,
        visionEnable: true,
        searchToolSupported: true,
        toolUse: true,
        maxTokens: 200000,
        outputPrice: 10.0,
        speed: 3,
        intelligence: 5,
        reasoning: 5,
        type: "llm_model",
      },
      {
        title: "Gemini 3 Flash Preview",
        value: "gemini-3-flash-preview",
        inputPrice: 0.3, // text/image/video
        context: 1000000,
        visionEnable: true,
        searchToolSupported: true,
        toolUse: true,
        maxTokens: 1000000,
        outputPrice: 2.5,
        speed: 4,
        intelligence: 4,
        reasoning: 4,
        type: "llm_model",
      },
      {
        title: "Gemini 2.5 Pro",
        value: "gemini-2.5-pro",
        inputPrice: 1.25, // prompts <= 200k tokens
        context: 200000,
        visionEnable: true,
        searchToolSupported: true,
        toolUse: true,
        maxTokens: 200000,
        outputPrice: 10.0,
        speed: 3,
        intelligence: 5,
        reasoning: 5,
        type: "llm_model",
      },
      {
        title: "Gemini 2.5 Flash",
        value: "gemini-2.5-flash",
        inputPrice: 0.3, // text/image/video
        context: 1000000,
        visionEnable: true,
        searchToolSupported: true,
        toolUse: true,
        maxTokens: 1000000,
        outputPrice: 2.5,
        speed: 4,
        intelligence: 4,
        reasoning: 4,
        type: "llm_model",
      },
      {
        title: "Gemini 2.5 Flash-Lite",
        value: "gemini-2.5-flash-lite",
        context: 1048576,
        visionEnable: true,
        searchToolSupported: true,
        toolUse: true,
        maxTokens: 1048576,
        inputPrice: 0.1, // text/image/video
        outputPrice: 0.4,
        speed: 5,
        intelligence: 3,
        reasoning: 3,
        type: "llm_model",
      }
    ];
  }


  try {
    const google = new GoogleGenAI({ apiKey: options.api_key });
    const pager = await google.models.list();
    const models: ListCache.ListItem[] = [];
    // console.log("gemini models", JSON.stringify(pager, null, 2))

    for await (const model of pager) {
      // console.log(model)

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

        // Find matching model data or use defaults
        const modelData = geminiModelsData.find(
          (data) => modelId === data.value,
        ) || {
          inputPrice: 0.1,
          outputPrice: 0.4,
          speed: 4,
          intelligence: 3,
          visionEnable: true,
          audioEnable: true,
          imageGeneration: false,
          audioGeneration: false,
          toolUse: true,
          type: "llm_model",
        };

        models.push({
          title: model.displayName || modelId,
          value: modelId,
          context: model.inputTokenLimit || 1000000, // Default 1M context
          maxTokens: model.outputTokenLimit || 8192, // Default max tokens
          visionEnable: modelData.visionEnable || true, // All Gemini models support vision
          audioEnable: modelData.audioEnable || true, // All Gemini models support audio
          imageGeneration: modelData.imageGeneration || false,
          audioGeneration: modelData.audioGeneration || isTTS || false,
          systemMessageEnable: true, // All Gemini models support system messages
          toolUse: modelData.toolUse || !isThinking, // Thinking models don't support tools
          speed: modelData.speed || 4,
          intelligence: modelData.intelligence || 3,
        });
      }
    }

    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
  const options = await req.json();

  const modelCache = new ListCache(fetchModels);

  const credentials = options.credentials;
  // console.log("gemini models credentials", credentials)

  const models = await modelCache.getList({
    ...options,
    api_key: credentials.apiKey,
  });

  return JSON.stringify(models);
}
