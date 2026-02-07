import {
  AssistantMessage,
  AuthProvider,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicUtil,
  convertMessagesToAnthropicMessages,
  streamFromAnthropic,
} from "./utils/anthropic_util.ts";
import { env } from "process";

import {
  MessageStreamParams,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/index.js";

export default function main(options: any) {
  return new AnthropicProvider(options);
}

export class AnthropicProvider extends LLMProvider {
  anthropic: Anthropic;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);

  }

  async initClient() {

    if (this.anthropic) {
      return;
    }

    const options = this.options;
    let headers: Record<string, string> = {};

    if (options.originCommandName === "enconvo_ai") {
      headers = {
        accessToken: `${env["accessToken"]}`,
        client_id: `${env["client_id"]}`,
        commandKey: `${env["commandKey"]}`,
        commandTitle: `${env["commandTitle"]}`,
        modelName: options.modelName.value,
      };
    }

    const credentials = options.credentials;
    const credentialsType = credentials?.credentials_type?.value || "apiKey";

    let oauthCredentials: AuthProvider.Credentials | null = null;
    if (credentialsType === "oauth2") {

      const authProvider = await AuthProvider.create("anthropic");
      oauthCredentials = await authProvider.loadCredentials();
      // console.log("loaded anthropic credentials", oauthCredentials,authProvider);

      headers["anthropic-beta"] =
        "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";
    }


    const anthropic = new Anthropic({
      apiKey:
        credentialsType === "apiKey" ? credentials?.anthropicApiKey : undefined,
      authToken:
        credentialsType === "oauth2" ? oauthCredentials?.access_token : undefined,
      baseURL: credentials?.anthropicApiUrl,
      defaultHeaders: headers,
    });

    this.anthropic = anthropic;
  }

  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    await this.initClient();
    const stream = await this._stream(content);
    let message = "";
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        message += chunk.delta.text;
      }
    }

    return new AssistantMessage(message);
  }


  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    console.log("AnthropicProvider _stream called");
    await this.initClient();
    const credentials = this.options.credentials;
    if (!credentials?.anthropicApiKey && !credentials?.access_token) {
      throw new Error("Anthropic API key or OAuth is required");
    }

    const params = await this.initParams(content);

    const stream = this.anthropic.messages.stream(params);

    return streamFromAnthropic(stream, stream.controller);
  }

  async initParams(content: LLMProvider.Params): Promise<MessageStreamParams> {
    const messages = content.messages;
    const systemMessages = messages.filter(
      (message) => message.role === "system",
    );
    const system: Array<TextBlockParam> = [];

    const credentialsType =
      this.options.credentials?.credentials_type?.value || "apiKey";
    if (credentialsType === "oauth2") {
      system.push({
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
      });
    }

    for (const message of systemMessages) {
      if (typeof message.content === "string") {
        system.push({
          type: "text",
          text: message.content,
        });
      } else {
        for (const content of message.content) {
          if (content.type === "text") {
            system.push({
              type: "text",
              text: content.text,
            });
          }
        }
      }
    }

    const conversationMessages = messages.filter(
      (message) => message.role !== "system",
    );

    const newMessages = await convertMessagesToAnthropicMessages(
      conversationMessages,
      this.options,
      content
    );

    const model = this.options.modelName.value;
    let temperature = Number(this.options.temperature.value);
    if (temperature > 1) {
      temperature = 1;
    }
    if (temperature < 0) {
      temperature = 0;
    }

    const defaultMaxTokens = this.options.modelName.maxTokens || 8192;

    let params: MessageStreamParams = {
      system,
      model: model,
      temperature: temperature,
      max_tokens: defaultMaxTokens,
      messages: newMessages,
    };

    const modelNameConfig: { reasoning_effort: string } = this.options?.modelName_preferences?.[params.model || '']
    let reasoning_effort = modelNameConfig?.reasoning_effort
    if (reasoning_effort && reasoning_effort !== "disabled" && reasoning_effort !== "none") {
      params.thinking = {
        type: "enabled",
        budget_tokens: parseInt(reasoning_effort),
      };
    }

    // console.log("reasoning_effort anthropic", params.thinking);
    let tools: Anthropic.ToolUnion[] = [];
    const newTools = AnthropicUtil.convertToolsToAnthropicTools(content.tools);
    if (newTools) {
      tools.push(...newTools);
    }

    if (content.searchToolEnabled === 'auto') {
      if (this.options.modelName.searchToolSupported === true) {
        tools.push({
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5
        });
        tools = tools.filter(tool => tool.name !== "google_web_search") || [];
      }
    }

    if (tools.length > 0) {
      params.tools = tools;
      if (content.tool_choice && typeof content.tool_choice !== "string") {
        params.tool_choice = {
          type: "tool",
          name: content.tool_choice.function.name,
          disable_parallel_tool_use: true,
        };
      } else {
        params.tool_choice = {
          type: "auto",
          disable_parallel_tool_use: true,
        };
      }
    }

    // console.log("anthropic params", JSON.stringify(params, null, 2));

    return params;
  }
}
