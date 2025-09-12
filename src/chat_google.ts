import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import {
  convertMessagesToGoogleMessages,
  GoogleUtil,
  streamFromGoogle,
} from "./utils/google_util.ts";
import { env } from "process";
import {
  FunctionCallingConfigMode,
  GenerateContentParameters,
  GoogleGenAI,
  Modality,
} from "@google/genai";
import { getCodeAssistServer } from "./utils/gemini-cli/code_assist/codeAssist.ts";
import { DEFAULT_GEMINI_FLASH_LITE_MODEL } from "./utils/gemini-cli/core/contentGenerator.ts";
import { Config } from "./utils/gemini-cli/code_assist/oauth2.ts";
import { CodeAssistServer } from "./utils/gemini-cli/code_assist/server.ts";
export default function main(options: any) {
  return new GoogleGeminiProvider(options);
}

export class GoogleGeminiProvider extends LLMProvider {
  ai: GoogleGenAI;
  server: CodeAssistServer | undefined;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);
    console.log("GoogleGeminiProvider constructor");
    const credentials = options.credentials;
    const google = new GoogleGenAI({ apiKey: credentials?.apiKey });

    this.ai = google;
  }


  async initCodeAssistServer() {
    const configParams = {
      sessionId: 'Enconvo',
      model: DEFAULT_GEMINI_FLASH_LITE_MODEL,
    };
    const config = new Config(configParams);

    this.server = await getCodeAssistServer(config);
  }


  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    const params = await this.initParams(content);

    const credentialsType = this.options.credentials?.credentials_type?.value || 'apiKey'
    let result
    if (credentialsType === 'oauth2') {
      if (!this.server) {
        await this.initCodeAssistServer();
      }
      result = await this.server!.generateContent(params, "Enconvo");
      return new AssistantMessage(result.text || "");
    } else {
      result = await this.ai.models.generateContent(params);
    }


    return new AssistantMessage(result.text || "");
  }


  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initParams(content);
    const credentialsType = this.options.credentials?.credentials_type?.value || 'apiKey'
    console.log("google credentialsType", credentialsType, this.options.session_id);

    let result
    if (credentialsType === 'oauth2') {
      console.log("is server", this.server === undefined);
      if (!this.server) {
        await this.initCodeAssistServer();
      }
      result = await this.server!.generateContentStream(params, "Enconvo");
    } else {
      result = await this.ai.models.generateContentStream(params);
    }

    return streamFromGoogle(result!, new AbortController());
  }

  async initParams(
    content: LLMProvider.Params,
  ): Promise<GenerateContentParameters> {
    const credentials = this.options.credentials;
    const credentialsType = credentials?.credentials_type?.value || 'apiKey'
    if (!credentials?.apiKey && credentialsType === 'apiKey') {
      throw new Error("Google API key is required");
    }

    const userMessages = content.messages.filter(
      (message) => message.role !== "system",
    );
    const systemMessages = content.messages.filter(
      (message) => message.role === "system",
    );

    let system =
      systemMessages.length > 0
        ? systemMessages
          .map((message) => {
            if (typeof message.content === "string") {
              return message.content;
            } else {
              return message.content
                .map((item) => {
                  if (item.type === "text") {
                    return item.text;
                  }
                  return JSON.stringify(item);
                })
                .join("\n\n");
            }
          })
          .join("\n\n")
        : undefined;

    function makeFirstMessageBeUserRole(messages: BaseChatMessageLike[]) {
      if (messages.length > 0 && messages[0].role !== "user") {
        messages.shift();
      }

      if (messages.length > 0 && messages[0].role !== "user") {
        return makeFirstMessageBeUserRole(messages);
      }

      return messages;
    }

    const fixedMessages = makeFirstMessageBeUserRole(userMessages);

    let newMessages = await convertMessagesToGoogleMessages(
      fixedMessages,
      this.options,
    );

    let headers = {};
    let baseUrl = credentials?.baseUrl;

    let model = this.options.modelName.value;

    if (this.options.originCommandName === "enconvo_ai") {
      headers = {
        accessToken: `${env["accessToken"]}`,
        client_id: `${env["client_id"]}`,
        commandKey: `${env["commandKey"]}`,
        commandTitle: `${env["commandTitle"]}`,
        modelName: model,
      };
      baseUrl = baseUrl;
      model = model.split("/")[1];
    }

    let tools = GoogleUtil.convertToolsToGoogleTools(content.tools);

    let toolConfig: any = undefined;
    if (typeof content.tool_choice === "object") {
      toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [content.tool_choice.function.name],
        },
      };
    } else if (tools && tools.length > 0) {
      toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      };
    }

    let responseModalities = [Modality.TEXT];
    if (this.options.modelName.imageGeneration) {
      responseModalities.push(Modality.IMAGE);
      system = undefined;
      tools = undefined;
    } else if (this.options.modelName.audioGeneration) {
      responseModalities = [Modality.AUDIO];
      const lastMessage = newMessages.pop();
      newMessages = lastMessage ? [lastMessage] : [];
      system = undefined;
      tools = undefined;
    }

    const maxTokens = this.options.maxTokens?.value || 8192;
    const temperature = this.options.temperature?.value || 0.7;
    const geminiThinking =
      this.options.gemini_thinking_pro?.value ||
      this.options.gemini_thinking?.value;

    let params: GenerateContentParameters = {
      model: model,
      contents: newMessages,
      config: {
        systemInstruction: system,
        tools: tools,
        toolConfig: toolConfig,
        maxOutputTokens: maxTokens,
        "topP": 1,
        temperature: 0,
        httpOptions: {
          baseUrl: baseUrl,
          headers: headers,
        },
        responseModalities: responseModalities,
      },
    };

    if (geminiThinking) {
      params.config!.thinkingConfig = {
        thinkingBudget:
          geminiThinking === "auto"
            ? -1
            : geminiThinking === "disabled"
              ? 0
              : parseInt(geminiThinking),
        includeThoughts: true,
      };
    }

    // console.log("gemini params", JSON.stringify(params.contents, null, 2))
    return params;
  }
}
