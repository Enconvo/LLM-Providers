import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  environment,
  LLMProvider,
  Stream,
  uuid,
} from "@enconvo/api";
import {
  convertMessagesToGoogleMessages,
  GoogleUtil,
  saveBinaryFile,
  saveWaveFile,
  streamFromGoogle,
} from "./utils/google_util.ts";
import { env } from "process";
import {
  FunctionCallingConfigMode,
  GenerateContentParameters,
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  Tool,
  ToolConfig,
} from "@google/genai";
import { getCodeAssistServer } from "./utils/gemini-cli/code_assist/codeAssist.ts";
import { DEFAULT_GEMINI_FLASH_LITE_MODEL } from "./utils/gemini-cli/core/contentGenerator.ts";
import { Config } from "./utils/gemini-cli/code_assist/oauth2.ts";
import { CodeAssistServer } from "./utils/gemini-cli/code_assist/server.ts";
import mime from "mime";
import path from "path";


export default function main(options: any) {
  return new GoogleGeminiProvider(options);
}

export class GoogleGeminiProvider extends LLMProvider {
  ai: GoogleGenAI;
  server: CodeAssistServer | undefined;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);
    const credentials = options.credentials;
    const google = new GoogleGenAI({ apiKey: credentials?.apiKey, vertexai: false });

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
    } else {
      result = await this.ai.models.generateContent(params);
    }

    // console.log("google result", JSON.stringify(result, null, 2))

    const candidate = result.candidates?.[0]
    const groundingMetadata = candidate?.groundingMetadata
    let additional: BaseChatMessage['additional'] = { metadata: {} }
    if (groundingMetadata) {
      const searchData: BaseChatMessage.Additional.Metadata.Search = {
        querys: groundingMetadata.webSearchQueries,
        chunks: groundingMetadata.groundingChunks?.map(chunk => ({
          web: {
            url: chunk.web?.uri,
            title: chunk.web?.title,
            domain: chunk.web?.domain || chunk.web?.title
          }
        })),
        texts: groundingMetadata.groundingSupports?.map(text => ({
          segment: text.segment,
          groundingChunkIndices: text.groundingChunkIndices
        }))
      }
      additional.metadata!.search = searchData
    }

    const messageContents: ChatMessageContent[] = [];

    for (const part of candidate?.content?.parts || []) {
      if (part.text) {
        messageContents.push(ChatMessageContent.text(part.text));
      }

      const inlineData = part?.inlineData;

      if (inlineData) {
        const isImage = result?.usageMetadata?.candidatesTokensDetails?.some(
          (detail) => detail.modality === "IMAGE",
        );
        const isAudio = result?.usageMetadata?.candidatesTokensDetails?.some(
          (detail) => detail.modality === "AUDIO",
        );
        if (isImage) {
          const fileName = uuid();
          let fileExtension = mime.getExtension(inlineData.mimeType || "");
          let buffer = Buffer.from(inlineData.data || "", "base64");

          const cachePath = environment.cachePath;
          const filePath = path.join(
            cachePath,
            `${fileName}.${fileExtension}`,
          );
          await saveBinaryFile(filePath, buffer);
          messageContents.push(ChatMessageContent.imageUrl({
            url: filePath,
          }));
        } else if (isAudio) {
          const fileName = uuid();
          let fileExtension = "wav";
          let buffer = Buffer.from(inlineData.data || "", "base64");

          const cachePath = environment.cachePath;
          const filePath = path.join(
            cachePath,
            `${fileName}.${fileExtension}`,
          );
          await saveWaveFile(filePath, buffer);
          messageContents.push(ChatMessageContent.audio({
            url: filePath,
          }));
        }
      }
    }

    // console.log("google messageContents", JSON.stringify(messageContents, null, 2))

    return new AssistantMessage({
      content: messageContents,
      additional
    });
  }


  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initParams(content);
    const credentialsType = this.options.credentials?.credentials_type?.value || 'apiKey'

    let result
    if (credentialsType === 'oauth2') {
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
    params: LLMProvider.Params,
  ): Promise<GenerateContentParameters> {
    const credentials = this.options.credentials;
    const credentialsType = credentials?.credentials_type?.value || 'apiKey'
    if (!credentials?.apiKey && credentialsType === 'apiKey') {
      throw new Error("Google API key is required");
    }

    const userMessages = params.messages.filter(
      (message) => message.role !== "system",
    );
    const systemMessages = params.messages.filter(
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
      params,
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


    let tools: Tool[] = [];
    // console.log("google_search", params.searchToolEnabled, params.tools?.length);
    if (params.searchToolEnabled === 'auto') {
      if (this.options.modelName.searchToolSupported === true) {
        // Define the grounding tool
        const groundingTool = {
          googleSearch: {},
        };

        if (!tools) {
          tools = [];
        }
        if (!params.tools || params.tools.length === 0) {
          tools.push(groundingTool);
        } else if (params.tools?.length === 1 && params.tools[0].name === "google_web_search") {
          tools.push(groundingTool);
          params.tools = params.tools?.filter(tool => tool.name !== "google_web_search") || [];
        }
      }
    }

    const newParamsTools = GoogleUtil.convertToolsToGoogleTools(params.tools)
    if (newParamsTools) {
      tools.push(...newParamsTools);
    }


    let toolConfig: ToolConfig | undefined = undefined;
    if (typeof params.tool_choice === "object") {
      toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [params.tool_choice.function.name],
        },
      };
    }

    let responseModalities = [Modality.TEXT];
    if (this.options.modelName.imageGeneration) {
      responseModalities.push(Modality.IMAGE);
      system = undefined;
      tools = [];
    } else if (this.options.modelName.audioGeneration) {
      responseModalities = [Modality.AUDIO];
      const lastMessage = newMessages.pop();
      newMessages = lastMessage ? [lastMessage] : [];
      system = undefined;
      tools = [];
    }

    // console.log("google tools", JSON.stringify(tools, null, 2))
    // console.log("url_context", params.webFetchToolEnabled);
    if (params.webFetchToolEnabled === 'auto') {
      // Define the grounding tool
      const urlContextTool = {
        urlContext: {},
      };

      if (!tools) {
        tools = [];
        tools.push(urlContextTool);
      }
    }


    // const maxTokens =  250;
    const maxTokens = this.options.maxTokens || 65536;
    // console.log("maxTokens", maxTokens)
    const temperature = this.options.temperature?.value || 0;


    const modelNameConfig: { reasoning_effort: string } = this.options?.modelName_preferences?.[model || '']
    let reasoning_effort = modelNameConfig?.reasoning_effort
    // console.log("reasoning_effort", reasoning_effort)

    let geminiParams: GenerateContentParameters = {
      model: model,
      contents: newMessages,
      config: {
        systemInstruction: system,
        tools: tools,
        toolConfig: toolConfig,
        maxOutputTokens: maxTokens,
        temperature: temperature,
        httpOptions: {
          baseUrl: baseUrl,
          headers: headers,
        },
        responseModalities: responseModalities,
      },
    };

    const isGemini3Series = model.includes("gemini-3");

    if (reasoning_effort && !isGemini3Series) {
      geminiParams.config!.thinkingConfig = {
        thinkingBudget:
          reasoning_effort === "auto"
            ? -1
            : (reasoning_effort === "disabled" || reasoning_effort === "none")
              ? 0
              : parseInt(reasoning_effort),
        includeThoughts: (reasoning_effort !== "disabled" && reasoning_effort !== "none") && this.options.show_thoughts === true,
      };
    }

    if (reasoning_effort && isGemini3Series) {
      geminiParams.config!.thinkingConfig = {
        thinkingLevel: reasoning_effort as ThinkingLevel,
        includeThoughts: this.options.show_thoughts === true,
      }
    }


    console.log("gemini params", JSON.stringify(geminiParams, null, 2))
    return geminiParams;
  }
}
