import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import { ChatRequest, Ollama } from "ollama";
import { OllamaUtil } from "./utils/ollama_util.ts";

export default function main(options: any) {
  return new OllamaProvider(options);
}

export class OllamaProvider extends LLMProvider {
  ollama: Ollama;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);
    const credentials = this.options.credentials;
    console.log("ollama credentials", credentials);

    const customHeaders: Record<string, string> = {};
    if (credentials?.customHeaders) {
      const headerString = credentials.customHeaders as string;
      const headerPairs = headerString
        .split("\n")
        .filter((line) => line.trim() && line.trim().includes("="));
      for (const pair of headerPairs) {
        const [key, value] = pair.split("=");
        if (key && value) {
          customHeaders[key.trim()] = value.trim();
        }
      }
    }

    this.ollama = new Ollama({
      host: credentials?.baseUrl,
      headers: {
        ...customHeaders,
        Authorization: `Bearer ${credentials?.apiKey || ""}`,
        "User-Agent": "Enconvo/1.0",
      },
    });
  }

  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {

    const params = await this.initParams(content);

    const response = await this.ollama.chat({
      ...params,
      stream: false,
    });

    return new AssistantMessage(response.message.content);
  }

  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {

    const params = await this.initParams(content);

    const response = await this.ollama.chat({
      ...params,
      stream: true,
    });

    return OllamaUtil.streamFromOllama(response);
  }

  async initParams(content: LLMProvider.Params): Promise<ChatRequest> {

    const newMessages = await OllamaUtil.convertMessagesToOllamaMessages(
      content.messages,
      this.options,
    );

    const params: ChatRequest = {
      model: this.options.modelName.value,
      messages: newMessages,
      tools: OllamaUtil.convertAIToolsToOllamaTools(content.tools),
      think: this.options.reasoning_effort.value === "enabled" ? undefined : false,
      options: {
        temperature: this.options.temperature.value || 1,
      }
    };


    console.log("ollama params", JSON.stringify(params, null, 2));
    return params;
  }
}
