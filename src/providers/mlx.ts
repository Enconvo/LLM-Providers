import { LLMProvider } from "@enconvo/api";
import { ChatOpenAIProvider } from "./open_ai.ts";

const MLX_OPENAI_BASE_URL = "http://127.0.0.1:54536/v1";

export default function main(options: any) {
  options.credentials = options.credentials || {};
  options.credentials.baseUrl = options.credentials.baseUrl || MLX_OPENAI_BASE_URL;
  options.credentials.apiKey = options.credentials.apiKey || "mlx";
  return new ChatMLXProvider(options);
}

export class ChatMLXProvider extends ChatOpenAIProvider {
  protected async initParams(content: LLMProvider.ResolvedParams) {
    const params = await super.initParams(content);
    params.chat_template_kwargs = {
      enable_thinking: false,
      ...(params.chat_template_kwargs || {}),
    };
    return params;
  }
}
