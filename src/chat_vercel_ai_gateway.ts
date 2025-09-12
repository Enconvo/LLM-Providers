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
    );

    const result = streamText({
      model: this.gateway(params.model),
      messages: messages,
      temperature: params.temperature,
      tools: tools,
      // toolChoice: params.toolChoice,
      abortSignal: params.abortSignal,
    });

    return streamFromVercel(result.fullStream);
  }

  async initParams(content: LLMProvider.Params): Promise<any> {
    const model = this.options.modelName.value;
    let temperature = Number(this.options.temperature.value);
    if (temperature > 1) {
      temperature = 1;
    }
    if (temperature < 0) {
      temperature = 0;
    }

    const defaultMaxTokens = this.options.modelName.maxTokens || 8192;

    const params: any = {
      model: model,
      temperature: temperature,
      maxTokens: defaultMaxTokens,
      abortSignal: new AbortController().signal,
    };

    const providerOrder = this.options.vercel_provider_order?.value;
    const providerOnly = this.options.vercel_provider_only?.value;

    if (providerOrder || providerOnly) {
      params.providerOptions = {
        gateway: {},
      };

      if (providerOrder) {
        params.providerOptions.gateway.order = providerOrder
          .split(",")
          .map((p: string) => p.trim());
      }

      if (providerOnly) {
        params.providerOptions.gateway.only = providerOnly
          .split(",")
          .map((p: string) => p.trim());
      }
    }

    return params;
  }
}
