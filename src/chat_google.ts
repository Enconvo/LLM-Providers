import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, LLMProvider, Stream } from "@enconvo/api";
import { convertMessagesToGoogleMessages, GoogleUtil, streamFromGoogle } from "./utils/google_util.ts";
import { env } from "process";
import { FunctionCallingConfigMode, GoogleGenAI, Modality } from '@google/genai';

export default function main(options: any) {
    return new GoogleGeminiProvider(options)
}

export class GoogleGeminiProvider extends LLMProvider {
    ai: GoogleGenAI;

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        console.log("options google", options)
        this.ai = new GoogleGenAI({ apiKey: options.apiKey });

    }


    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const params = this.initParams(content)

        // console.log("params", params)
        const result = await this.ai.models.generateContent({
            model: params.model,
            contents: params.messages,
            config: {
                systemInstruction: params.system,
                tools: params.tools,
                toolConfig: params.toolConfig,
                temperature: params.temperature,
                httpOptions: {
                    baseUrl: params.baseUrl,
                    headers: params.headers
                },
                responseModalities: params.responseModalities
            }
        })

        return new AssistantMessage(result.text || '')
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const params = this.initParams(content)

        const result = await this.ai.models.generateContentStream({
            model: params.model,
            contents: params.messages,
            config: {
                systemInstruction: params.system,
                tools: params.tools,
                toolConfig: params.toolConfig,
                temperature: params.temperature,
                httpOptions: {
                    baseUrl: params.baseUrl,
                    headers: params.headers
                },
                responseModalities: params.responseModalities,
                responseMimeType: 'text/plain',
                thinkingConfig: {
                    includeThoughts: true
                }
            }
        })

        return streamFromGoogle(result, new AbortController())
    }



    initParams(content: LLMProvider.Params) {
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

        let newMessages = convertMessagesToGoogleMessages(fixedMessages, this.options)

        let headers = {}
        let baseUrl = this.options.baseUrl

        let model = this.options.modelName.value

        if (this.options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "commandTitle": `${env['commandTitle']}`,
                "modelName": model
            }
            baseUrl = this.options.baseUrl
            model = model.split('/')[1]
        }


        let tools = GoogleUtil.convertToolsToGoogleTools(content.tools)
        // console.log("tools", tools)

        let toolConfig = {}
        if (typeof content.tool_choice === "object") {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.ANY,
                    allowedFunctionNames: [content.tool_choice.function.name]
                }
            }
        } else {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingConfigMode.AUTO
                }
            }
        }

        const responseModalities = [Modality.TEXT]
        if (this.options.modelName.value.includes('image-generation')) {
            responseModalities.push(Modality.IMAGE)
            system = undefined
            tools = undefined
        }


        return {
            system,
            model,
            temperature: this.options.temperature.value,
            max_tokens: 1024,
            messages: newMessages,
            headers,
            baseUrl,
            tools,
            toolConfig,
            responseModalities
        }

    }

}