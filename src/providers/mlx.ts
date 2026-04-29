import { LLMProvider } from "@enconvo/api";
import OpenAI from "openai";
import { ChatOpenAIProvider } from "./open_ai.ts";

const MLX_BASE_URL = "http://localhost:54535/mlx_manage/mlx_lm";

export default function main(options: any) {
  options.credentials = options.credentials || {};
  options.credentials.apiKey = options.credentials.apiKey || "mlx";
  return new MLXProvider(options);
}

export class MLXProvider extends ChatOpenAIProvider {
  protected async _createOpenaiClient(
    _options: LLMProvider.LLMOptions,
  ): Promise<OpenAI> {
    return new OpenAI({
      apiKey: "mlx",
      baseURL: MLX_BASE_URL,
      fetch: async (url, init) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const rewritten = urlStr.replace(
          /\/chat\/completions(\?|$)/,
          "/stream_chat$1",
        );
        return globalThis.fetch(rewritten, init);
      },
    });
  }
}
