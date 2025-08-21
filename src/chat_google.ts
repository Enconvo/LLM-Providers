import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, LLMProvider, Stream } from "@enconvo/api";
import { convertMessagesToGoogleMessages, GoogleUtil, streamFromGoogle } from "./utils/google_util.ts";
import { env } from "process";
import { FunctionCallingConfigMode, GenerateContentParameters, GoogleGenAI, Modality } from '@google/genai';
import { wrapSDK } from "langsmith/wrappers";
export default function main(options: any) {
    return new GoogleGeminiProvider(options)
}

export class GoogleGeminiProvider extends LLMProvider {
    ai: GoogleGenAI;

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        const credentials = options.credentials
        const google = new GoogleGenAI({ apiKey: credentials?.apiKey });

        if (env['LANGCHAIN_TRACING_V2'] === 'true') {
            this.ai = wrapSDK(google)
        } else {
            this.ai = google
        }
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const params = await this.initParams(content)

        const result = await this.ai.models.generateContent(params)

        return new AssistantMessage(result.text || '')
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const params = await this.initParams(content)

        const result = await this.ai.models.generateContentStream(params)

        return streamFromGoogle(result, new AbortController())
    }



    async initParams(content: LLMProvider.Params): Promise<GenerateContentParameters> {
        const credentials = this.options.credentials
        if (!credentials?.apiKey) {
            throw new Error("Google API key is required")
        }

        const userMessages = content.messages.filter((message) => message.role !== 'system')
        const systemMessages = content.messages.filter((message) => message.role === 'system')

        let system = systemMessages.length > 0 ? systemMessages.map((message) => {
            if (typeof message.content === "string") {
                return message.content
            } else {
                return message.content.map((item) => {
                    if (item.type === "text") {
                        return item.text
                    }
                    return JSON.stringify(item)
                }).join("\n\n")
            }
        }).join("\n\n") : undefined


        function makeFirstMessageBeUserRole(messages: BaseChatMessageLike[]) {
            if (messages.length > 0 && messages[0].role !== 'user') {
                messages.shift();
            }

            if (messages.length > 0 && messages[0].role !== 'user') {
                return makeFirstMessageBeUserRole(messages);
            }

            return messages
        }

        const fixedMessages = makeFirstMessageBeUserRole(userMessages)

        let newMessages = await convertMessagesToGoogleMessages(fixedMessages, this.options)

        let headers = {}
        let baseUrl = credentials.baseUrl

        let model = this.options.modelName.value

        if (this.options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "commandTitle": `${env['commandTitle']}`,
                "modelName": model
            }
            baseUrl = baseUrl
            model = model.split('/')[1]
        }


        let tools = GoogleUtil.convertToolsToGoogleTools(content.tools)

        let toolConfig: any = undefined
        if (typeof content.tool_choice === "object") {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.ANY,
                    allowedFunctionNames: [content.tool_choice.function.name]
                }
            }
        } else if (tools && tools.length > 0) {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            }
        }

        let responseModalities = [Modality.TEXT]
        if (this.options.modelName.value.includes('image-generation')) {
            responseModalities.push(Modality.IMAGE)
            system = undefined
            tools = undefined
        } else if (this.options.modelName.value.includes('tts')) {
            responseModalities = [Modality.AUDIO]
            const lastMessage = newMessages.pop()
            newMessages = lastMessage ? [lastMessage] : []
            system = undefined
            tools = undefined
        }

        const maxTokens = this.options.maxTokens?.value || 8192
        const temperature = this.options.temperature?.value || 0.7
        const geminiThinking = this.options.gemini_thinking_pro?.value || this.options.gemini_thinking?.value

        let params: GenerateContentParameters = {
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
                    headers: headers
                },
                responseModalities: responseModalities,
            }
        }

        if (geminiThinking) {
            params.config!.thinkingConfig = {
                thinkingBudget: geminiThinking === 'auto' ? -1 : geminiThinking === 'disabled' ? 0 : parseInt(geminiThinking),
                includeThoughts: true
            }
        }

        // console.log("gemini params", JSON.stringify(params.contents, null, 2))
        return params
    }

}