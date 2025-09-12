import { ListCache, RequestOptions } from "@enconvo/api";
import { createGateway } from "@ai-sdk/gateway";

/**
 * Fetches models from the Vercel AI Gateway API
 * @param options - Request options containing credentials
 * @returns Promise<ListCache.ListItem[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  const credentials = options.credentials;

  if (!credentials?.apiKey) {
    return [];
  }

  const gateway = createGateway({
    apiKey: credentials.apiKey
  });

  try {
    const availableModels = await gateway.getAvailableModels();

    const result: ListCache.ListItem[] = availableModels.models.map((model) => {
      // Map model types to features
      const isEmbedding = model.modelType === "embedding";
      const visionEnable =
        !isEmbedding && model.name?.toLowerCase().includes("vision");
      const toolUse = !isEmbedding;

      // Calculate pricing (convert from per-token to per-million tokens)
      const inputPrice = model.pricing?.input
        ? Number(model.pricing.input) * 1000000
        : 1;
      const outputPrice = model.pricing?.output
        ? Number(model.pricing.output) * 1000000
        : 1;

      // Estimate speed and intelligence based on model name and provider
      let speed = 3;
      let intelligence = 3;
      let maxTokens = 8192;
      let context = 128000;

      // Adjust based on model ID patterns
      if (model.id.includes("gpt-5")) {
        intelligence = 5;
        speed = 4;
        maxTokens = 131072;
        context = 200000;
      } else if (model.id.includes("gpt-4")) {
        intelligence = 4;
        speed = 3;
        maxTokens = 131072;
        context = 128000;
      } else if (model.id.includes("claude-opus")) {
        intelligence = 5;
        speed = 3;
        maxTokens = 32000;
        context = 200000;
      } else if (model.id.includes("claude-sonnet")) {
        intelligence = 4;
        speed = 4;
        maxTokens = 64000;
        context = 200000;
      } else if (model.id.includes("claude-haiku")) {
        intelligence = 3;
        speed = 5;
        maxTokens = 8192;
        context = 200000;
      } else if (
        model.id.includes("gemini-pro") ||
        model.id.includes("gemini-1.5")
      ) {
        intelligence = 4;
        speed = 4;
        maxTokens = 8192;
        context = 1000000;
      } else if (model.id.includes("grok")) {
        intelligence = 4;
        speed = 4;
        maxTokens = 131072;
        context = 128000;
      } else if (model.id.includes("llama")) {
        intelligence = 3;
        speed = 4;
        maxTokens = 8192;
        context = 128000;
      } else if (model.id.includes("mistral")) {
        intelligence = 3;
        speed = 4;
        maxTokens = 32768;
        context = 128000;
      } else if (model.id.includes("deepseek")) {
        intelligence = 4;
        speed = 4;
        maxTokens = 65536;
        context = 128000;
      } else if (model.id.includes("embedding")) {
        // Embedding models don't need these attributes
        speed = 5;
        intelligence = 0;
        maxTokens = 0;
        context = 8192;
      }

      return {
        title: model.name || model.id,
        value: model.id,
        description: model.description,
        context: context,
        inputPrice: inputPrice,
        outputPrice: outputPrice,
        toolUse: toolUse,
        visionEnable: visionEnable,
        maxTokens: maxTokens,
        speed: speed,
        intelligence: intelligence,
        modelType: model.modelType || "language",
      };
    });

    // Sort models by intelligence (highest first), then by speed
    result.sort((a, b) => {
      if (b.intelligence !== a.intelligence) {
        return b.intelligence - a.intelligence;
      }
      return b.speed - a.speed;
    });

    return result;
  } catch (error) {
    console.error("Error fetching Vercel AI Gateway models:", error);
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

  const models = await modelCache.getList(options);

  return JSON.stringify(models);
}
