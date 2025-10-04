import { env } from "process";
import {
  AuthProvider,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
  UserMessage,
} from "@enconvo/api";
import OpenAI from "openai";
import { OpenAIUtil } from "./utils/openai_util.ts";
import { codex_instructions } from "./utils/instructions.ts";

export default function main(options: any) {
  return new ChatOpenAIProvider(options);
}

export class ChatOpenAIProvider extends LLMProvider {
  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    this.client = await this._createOpenaiClient(this.options);
    // console.log("this.options", this.options)
    const credentialsType = this.options.credentials?.credentials_type?.value;
    const apiType = this.options.credentials?.api_type?.value || "completions";
    console.log("apiType", apiType)

    const isCodex = credentialsType === "oauth2" && this.options.originCommandName === "chat_open_ai"
    const isUseEnconvoResponsesAPI = this.options.modelName.providerName === 'openai' && this.options.originCommandName === "enconvo_ai"

    if (isCodex || apiType === "responses" || isUseEnconvoResponsesAPI) {
      console.log("_stream_v2");
      const credentials = this.options.credentials;
      // console.log("openai credentials", credentials)
      if (!credentials?.access_token && isCodex) {
        throw new Error("Please authorize with OAuth2 first");
      }
      return await this._stream_v2(content, isCodex);
    }

    const params = await this.initParams(content);
    // console.log("openai params", JSON.stringify(params, null, 2))

    let chatCompletion: any;
    chatCompletion = await this.client.chat.completions.create({
      ...params,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    });

    const ac = new AbortController();
    //@ts-ignore
    const stream = OpenAIUtil.streamFromOpenAI(
      chatCompletion,
      ac,
      this.options,
    );
    return stream;
  }

  protected async _stream_v2(
    content: LLMProvider.Params,
    isCodex: boolean = false,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initResponseParams(content, isCodex);
    const response = await this.client.responses.create({
      ...params
    });

    const ac = new AbortController();
    //@ts-ignore
    const stream = OpenAIUtil.streamFromOpenAIResponse(response, ac);
    return stream;
  }

  client: OpenAI;

  protected async _call(content: {
    messages: BaseChatMessage[];
  }): Promise<BaseChatMessage> {
    this.client = await this._createOpenaiClient(this.options);
    const params = await this.initParams(content);

    const chatCompletion = await this.client.chat.completions.create({
      ...params,
    });

    const result = chatCompletion.choices[0];

    return new UserMessage(result?.message?.content || "");
  }

  private async initResponseParams(
    content: LLMProvider.Params,
    isCodex: boolean = false,
  ): Promise<OpenAI.Responses.ResponseCreateParamsStreaming> {
    // console.log("openai options", JSON.stringify(content.messages, null, 2))

    const modelOptions = this.options.modelName;

    let instructions = '';
    if (isCodex) {
      instructions = codex_instructions;
    } else {
      const systemMessages = content.messages.filter(message => message.role === "system");
      content.messages = content.messages.filter(message => message.role !== "system");
      instructions = systemMessages.map(message => {
        if (typeof message.content === "string") {
          return message.content;
        } else {
          return message.content.map(item => {
            if (item.type === "text") {
              return item.text;
            }
            return JSON.stringify(item);
          }).join("\n\n");
        }
      }).join("\n\n");
    }

    const messages = await OpenAIUtil.convertMessagesToOpenAIResponseMessages(
      this.options,
      content.messages,
      content,
    );

    let params: OpenAI.Responses.ResponseCreateParamsStreaming = {
      model: modelOptions?.value,
      instructions: instructions,
      stream: true,
      tool_choice: "auto",
      parallel_tool_calls: false,
      store: false,
      include: [],
      prompt_cache_key: "d36d744d-0c64-4b25-9c5a-3e132dbb2e18",
    };


    let tools: OpenAI.Responses.Tool[] = []

    const newTools = OpenAIUtil.convertToolsToOpenAIResponseTools(content.tools);
    if (newTools) {
      tools.push(...newTools);
    }

    if (content.searchToolEnabled === 'auto') {
      if (modelOptions.searchToolSupported === true) {
        tools.push({
          type: "web_search_preview",
        });
        tools = tools.filter(tool => !(tool.type === 'function' && tool.name === "google_web_search")) || [];
      }
    }


    params.input = messages;

    if (tools.length > 0) {
      params.tools = tools;
    }

    let reasoning_effort = this.options?.reasoning_effort?.value || this.options?.reasoning_effort_new?.value;
    if (reasoning_effort && reasoning_effort !== "off") {
      if (reasoning_effort === 'minimal' && tools.some(tool => tool.type === 'web_search_preview' || tool.type === 'image_generation')) {
        reasoning_effort = 'low';
      }

      params.reasoning = {
        effort: reasoning_effort,
        summary: null,
      };
    }

    // console.log("response params", JSON.stringify(params, null, 2))
    return params;
  }

  private async initParams(content: LLMProvider.Params) {
    // console.log("openai options", JSON.stringify(this.options, null, 2))
    const credentials = this.options.credentials;
    const credentialsType = credentials?.credentials_type?.value || "apiKey";
    if (!credentials?.apiKey && credentialsType === "apiKey") {
      throw new Error("API key is required");
    }

    if (!credentials?.access_token && credentialsType === "oauth2") {
      throw new Error("Please authorize with OAuth2 first");
    }

    const modelOptions = this.options.modelName;

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
      model: modelOptions?.value,
      temperature: temperature,
      messages,
    };

    let reasoning_effort =
      this.options?.reasoning_effort?.value ||
      this.options?.reasoning_effort_new?.value;
    if (reasoning_effort && reasoning_effort !== "off") {
      params.reasoning_effort = reasoning_effort;
    }

    if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
      params = {
        ...params,
        tools,
        tool_choice: content.tool_choice,
        parallel_tool_calls: modelOptions?.toolUse === true ? false : null,
      };
    }

    console.log("openai params", JSON.stringify(params, null, 2));

    return params;
  }

  private async _createOpenaiClient(
    options: LLMProvider.LLMOptions,
  ): Promise<OpenAI> {
    let credentials = options.credentials || null;
    const credentialsType = credentials?.credentials_type?.value || "apiKey";
    console.log("options.originCommandName", options.originCommandName, credentialsType)
    if (
      credentialsType === "oauth2" &&
      options.originCommandName === "chat_open_ai"
    ) {
      const client = new OpenAI({
        apiKey: "key",
        defaultHeaders: {
          Authorization: `Bearer ${credentials?.access_token}`,
          "chatgpt-account-id": credentials?.account_id,
          "OpenAI-Beta": "responses=experimental",
          session_id: "a55064f6-4010-4e60-876d-a7ca1cb8d401",
        },
        fetch: async (url, init) => {
          // console.log("url", url, init)
          return fetch("https://chatgpt.com/backend-api/codex/responses", init);
        },
      });
      return client;
    }

    let headers = {};

    if (options.originCommandName === "enconvo_ai") {
      // Encode commandTitle to handle special characters in HTTP headers
      headers = {
        accessToken: `${env["accessToken"]}`,
        client_id: `${env["client_id"]}`,
        commandKey: `${env["commandKey"]}`,
        commandTitle: `${env["commandTitle"]}`,
        modelName: options.modelName.value,
      };
    } else if (options.originCommandName === "chat_openrouter") {
      headers = {
        "HTTP-Referer": "https://enconvo.ai",
        "X-Title": "Enconvo",
      };
    } else if (options.originCommandName === "chat_qwen") {
      const userAgent = `QwenCode/0.0.10 (${process.platform}; ${process.arch})`;
      headers = {
        "User-Agent": userAgent,
      };

      if (credentialsType === "oauth2") {
        const authProvider = await AuthProvider.create("qwen");
        //@ts-ignore
        credentials = await authProvider.authenticate();
        // console.log("loaded credentials", credentials);
      }
    }

    if (
      options.modelName &&
      (options.modelName.value === "openai/o1-mini" ||
        options.modelName.value === "openai/o1-preview" ||
        options.modelName.value === "o1-mini" ||
        options.modelName.value === "o1-preview")
    ) {
      options.max_completion_tokens = options.maxTokens;
      delete options.maxTokens;
    }

    if (options.baseUrl === "http://127.0.0.1:5001") {
      options.frequencyPenalty = 0.0001;
    }
    // console.log("credentials", options.originCommandName, credentialsType);
    const apiKey =
      credentialsType === "oauth2"
        ? credentials?.access_token
        : credentials?.apiKey;
    let baseURL = credentials?.baseUrl || "https://api.openai.com/v1";
    if (options.originCommandName === "chat_qwen" && credentialsType === "oauth2") {
      baseURL = `https://${credentials?.resource_url}/v1`;
    }

    // console.log("headers", headers)
    // console.log("apiKey", apiKey)
    // console.log("baseURL", baseURL)

    const client = new OpenAI({
      apiKey: apiKey, // This is the default and can be omitted
      // baseURL: "http://127.0.0.1:8181/v1",
      baseURL: baseURL,
      defaultHeaders: headers,
    });

    return client;
  }
}
