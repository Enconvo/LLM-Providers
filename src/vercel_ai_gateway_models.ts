import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import { createGateway } from "@ai-sdk/gateway";
import { getClaudeModelData } from "./utils/claude_models_data.js";

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
    apiKey: credentials.apiKey,
  });

  try {
    const availableModels = await gateway.getAvailableModels();
    // console.log("availableModels", JSON.stringify(availableModels, null, 2));

    const result: Preference.LLMModel[] = availableModels.models
      .filter((model) => model.modelType === "language")
      .map((model) => {
        // Map model types to features
        let visionEnable = model.name?.toLowerCase().includes("vision");
        let toolUse = true;

        // Calculate pricing (convert from per-token to per-million tokens)
        let inputPrice = model.pricing?.input
          ? Number(model.pricing.input) * 1000000
          : 1;
        let outputPrice = model.pricing?.output
          ? Number(model.pricing.output) * 1000000
          : 1;

        // Estimate speed and intelligence based on model name and provider
        let speed = 3;
        let intelligence = 3;
        let maxTokens = 8192;
        let context = 128000;

        if (model.specification.provider === 'anthropic') {
          if (model.id.includes("claude-opus-4-1")) {
            // Claude Opus 4.1 - Most capable model
            maxTokens = 32000;
            inputPrice = 15;
            outputPrice = 75;
            speed = 3; // Moderately fast
            intelligence = 5; // Highest intelligence
          } else if (model.id.includes("claude-opus-4")) {
            // Claude Opus 4 - Previous flagship model
            maxTokens = 32000;
            inputPrice = 15;
            outputPrice = 75;
            speed = 3; // Moderately fast
            intelligence = 5; // Very high intelligence
          } else if (model.id.includes("claude-sonnet-4")) {
            // Claude Sonnet 4 - High-performance model
            maxTokens = 64000;
            inputPrice = 3;
            outputPrice = 15;
            speed = 4; // Fast
            intelligence = 4; // High intelligence
          } else if (model.id.includes("claude-3-7-sonnet")) {
            // Claude Sonnet 3.7 - High-performance with extended thinking
            maxTokens = 64000;
            inputPrice = 3;
            outputPrice = 15;
            speed = 4; // Fast
            intelligence = 4; // High intelligence with extended thinking
          } else if (model.id.includes("claude-3-5-sonnet")) {
            // Claude Sonnet 3.5 - Previous intelligent model
            maxTokens = 8192;
            inputPrice = 3;
            outputPrice = 15;
            speed = 4; // Fast
            intelligence = 4; // High intelligence
          } else if (model.id.includes("claude-3-5-haiku")) {
            // Claude Haiku 3.5 - Fastest model
            maxTokens = 8192;
            inputPrice = 0.8;
            outputPrice = 4;
            speed = 5; // Fastest
            intelligence = 3; // Intelligence at blazing speeds
          } else if (model.id.includes("claude-3-opus")) {
            // Claude Opus 3 - Previous high-capability model
            maxTokens = 32000;
            inputPrice = 15;
            outputPrice = 75;
            speed = 3; // Moderately fast
            intelligence = 4; // High intelligence
          } else if (model.id.includes("claude-3-haiku")) {
            // Claude Haiku 3 - Fast and compact model
            maxTokens = 4096;
            inputPrice = 0.25;
            outputPrice = 1.25;
            speed = 4; // Fast
            intelligence = 2; // Quick and accurate targeted performance
          }
        } else if (model.id.startsWith("google/")) {
          visionEnable = true;
          toolUse = true;
          maxTokens = 8192;
          context = 1000000;
        } else if (model.id.startsWith('openai/')) {
          visionEnable = true;
          toolUse = true;
          context = 1047576;
          maxTokens = 32768;
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
        }

        return {
          type: "llm_model",
          title: model.name || model.id,
          value: model.id,
          context: context,
          inputPrice: inputPrice,
          outputPrice: outputPrice,
          toolUse: toolUse,
          visionEnable: visionEnable,
          maxTokens: maxTokens,
          speed: speed,
          intelligence: intelligence,
          modelType: model.modelType,
        };
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
