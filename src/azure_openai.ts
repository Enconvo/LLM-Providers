import {
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
  UserMessage,
} from "@enconvo/api";
import { AzureOpenAI } from "openai";
import { OpenAIUtil } from "./utils/openai_util.ts";

export default function main(options: any) {
  return new ChatOpenAIProvider(options);
}

class ChatOpenAIProvider extends LLMProvider {
  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initParams(content);
    // console.log("params", params)

    const chatCompletion = await this.client.chat.completions.create({
      ...params,
      stream: true,
    });

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

  protected async _call(content: {
    messages: BaseChatMessage[];
  }): Promise<BaseChatMessage> {
    const params = await this.initParams(content);

    const chatCompletion = await this.client.chat.completions.create({
      ...params,
    });

    const result = chatCompletion.choices[0];

    return new UserMessage(result?.message?.content || "");
  }

  private async initParams(content: LLMProvider.Params) {
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
