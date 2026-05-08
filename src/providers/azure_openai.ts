import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import { AzureOpenAI } from "openai";
import { OpenAIUtil } from "../utils/openai_util.ts";
import {
  additionalWithProviderUsage,
  usageFromOpenAIChatUsage,
} from "../utils/usage_util.ts";
import { getOutputTokenLimit } from "../utils/provider_param_util.ts";

export default function main(options: any) {
  return new ChatOpenAIProvider(options);
}

class ChatOpenAIProvider extends LLMProvider {
  protected async _stream(
    content: LLMProvider.ResolvedParams,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initParams(content);
    // console.log("params", params)

    const chatCompletion = await this.client.chat.completions.create(
      {
        ...params,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      },
      {
        signal: content.signal,
      },
    );

    const ac = new AbortController();
    //@ts-ignore
    const stream = OpenAIUtil.streamFromOpenAI(chatCompletion, ac);
    return stream;
  }

  client: AzureOpenAI;
  constructor(options: LLMProvider.LLMOptions) {
    super(options);
    this.client = this._createOpenaiClient(this.options);
  }

  protected async _call(
    content: LLMProvider.ResolvedParams,
  ): Promise<BaseChatMessage> {
    const params = await this.initParams(content);

    const chatCompletion = await this.client.chat.completions.create(
      {
        ...params,
      },
      {
        signal: content.signal,
      },
    );

    const result = chatCompletion.choices[0];

    return new AssistantMessage({
      content: result?.message?.content || "",
      additional: additionalWithProviderUsage(
        undefined,
        usageFromOpenAIChatUsage(chatCompletion.usage),
      ),
    });
  }

  private async initParams(content: LLMProvider.ResolvedParams) {
    if (!this.options.credentials?.azureOpenAIApiKey) {
      throw new Error("API key is required");
    }

    if (!this.options.credentials?.azureOpenAIApiEndpoint) {
      throw new Error("Endpoint is required");
    }

    if (!this.options.credentials?.azureOpenAIApiVersion) {
      throw new Error("API version is required");
    }

    const modelOptions = this.options.modelName;
    if (!modelOptions) {
      throw new Error("Model name is required");
    }

    const messages = await OpenAIUtil.convertMessagesToOpenAIMessages(
      this.options,
      content.messages,
      content,
    );

    const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools);

    let temperature = this.options.temperature.value;
    try {
      temperature =
        typeof temperature === "string" ? parseFloat(temperature) : temperature;
    } catch (e) {
      temperature = 0.5;
    }

    if (modelOptions?.value.includes("gpt-5")) {
      temperature = 1;
    }

    let params: any = {
      temperature: temperature,
      messages,
    };
    const outputTokenLimit = getOutputTokenLimit(content.modelParams);
    if (outputTokenLimit) {
      if (usesMaxCompletionTokens(modelOptions?.value)) {
        params.max_completion_tokens = outputTokenLimit;
      } else {
        params.max_tokens = outputTokenLimit;
      }
    }

    let reasoning_effort =
      this.options?.reasoning_effort?.value ||
      this.options?.reasoning_effort_new?.value;
    if (reasoning_effort && reasoning_effort !== "off") {
      params.reasoning_effort = reasoning_effort;
    }
    console.log("tools", tools?.length, modelOptions.toolUse);

    if (tools && tools.length > 0 && modelOptions.toolUse === true) {
      params = {
        ...params,
        tools,
        tool_choice: content.tool_choice,
        parallel_tool_calls: modelOptions.toolUse === true ? false : null,
      };
    }

    return params;
  }

  private _createOpenaiClient(options: LLMProvider.LLMOptions): AzureOpenAI {
    const client = new AzureOpenAI({
      apiKey: options.credentials?.azureOpenAIApiKey,
      apiVersion: options.credentials?.azureOpenAIApiVersion,
      endpoint: options.credentials?.azureOpenAIApiEndpoint,
      deployment: options.modelName.value,
    });

    return client;
  }
}

function usesMaxCompletionTokens(model?: string): boolean {
  return Boolean(model && /(^|[/:-])(gpt-5|o1|o3|o4)/i.test(model));
}
