import {
  AITool,
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import {
  dynamicTool,
  jsonSchema,
  JSONSchema7,
  JSONValue,
  streamText,
  Tool,
  ToolCallOptions,
  ToolSet,
} from "ai";
import {
  convertMessagesToVercelFormat,
  streamFromVercel,
} from "./utils/vercel_ai_gateway_util.ts";
import { createGateway, GatewayProvider } from "@ai-sdk/gateway";
export default function main(options: any) {
  return new VercelAIGatewayProvider(options);
}

export class VercelAIGatewayProvider extends LLMProvider {
  gateway: GatewayProvider;
  constructor(options: LLMProvider.LLMOptions) {
    super(options);

    const credentials = options.credentials;
    if (!credentials?.apiKey) {
      throw new Error("Vercel AI Gateway API key is required");
    }

    this.gateway = createGateway({
      apiKey: credentials.apiKey,
    });
  }

  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    const stream = await this._stream(content);
    let message = "";
    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.delta?.content) {
        message += chunk.choices[0].delta.content;
      }
    }
    return new AssistantMessage(message);
  }

  async tools(aiTools: AITool[]): Promise<ToolSet> {
    const tools: Record<string, Tool> = {};

    for (const { name, description, parameters: inputSchema } of aiTools) {
      const toolWithExecute = dynamicTool({
        description,
        inputSchema: jsonSchema({
          ...inputSchema,
          properties: inputSchema?.properties ?? {},
          additionalProperties: false,
        } as JSONSchema7),
        execute: async (args: any, options: ToolCallOptions) => {
          options?.abortSignal?.throwIfAborted();
        },
      });

      tools[name] = toolWithExecute;
    }

    return tools;
  }

  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const credentials = this.options.credentials;
    if (!credentials?.apiKey) {
      throw new Error("Vercel AI Gateway API key is required");
    }

    const params = await this.initParams(content);

    const tools = await this.tools(content.tools || []);

    const messages = await convertMessagesToVercelFormat(
      content.messages,
      this.options,
      content
    );


    let providerOptions: Record<string, Record<string, JSONValue>> = {}

    if (params.model.startsWith('openai/')) {
      let reasoning_effort = this.options?.reasoning_effort?.value || this.options?.reasoning_effort_new?.value;

      let openaiOptions: Record<string, JSONValue> = {}

      if (reasoning_effort && reasoning_effort !== "off") {
        openaiOptions.reasoningSummary = "auto";
        openaiOptions.reasoningEffort = reasoning_effort;
      }

      providerOptions.openai = openaiOptions
    } else if (params.model.startsWith('anthropic/')) {
      const claudeThinking = this.options.claude_thinking?.value;
      let anthropicOptions: Record<string, JSONValue> = {
        cacheControl: { type: "ephemeral" }
      }

      if (claudeThinking && claudeThinking !== "disabled") {
        anthropicOptions.thinking = {
          type: "enabled",
          budgetTokens: parseInt(claudeThinking),
        };
      }

      providerOptions.anthropic = anthropicOptions
    } else if (params.model.startsWith('google/')) {
      let geminiOptions: Record<string, JSONValue> = {}
      const geminiThinking = this.options.gemini_thinking_pro?.value || this.options.gemini_thinking?.value;

      if (geminiThinking) {
        geminiOptions.thinkingConfig = {
          thinkingBudget:
            geminiThinking === "auto"
              ? -1
              : geminiThinking === "disabled"
                ? 0
                : parseInt(geminiThinking),
          includeThoughts: true,
        };
      }

      providerOptions.google = geminiOptions
    }
    console.log("providerOptions", JSON.stringify(providerOptions, null, 2))


    const result = streamText({
      model: this.gateway(params.model),
      messages: messages,
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
      tools: tools,
      // toolChoice: params.toolChoice,
      abortSignal: params.abortSignal,
      providerOptions: providerOptions,
    });

    return streamFromVercel(result.fullStream);
  }

  async initParams(content: LLMProvider.Params) {
    const model = this.options.modelName.value;
    let temperature = Number(this.options.temperature.value);
    if (temperature > 1) {
      temperature = 1;
    }
    if (temperature < 0) {
      temperature = 0;
    }

    const defaultMaxTokens = this.options.modelName.maxTokens || 8192;

    const params = {
      model: model,
      temperature: temperature,
      maxTokens: defaultMaxTokens,
      abortSignal: new AbortController().signal,
    };

    return params;
  }
}
