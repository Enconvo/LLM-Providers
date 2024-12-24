import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { convertMessagesToGoogleMessages, streamFromGoogle } from "./utils/google_util.ts";
import { env } from "process";

export default function main(options: any) {
    return new GoogleGeminiProvider(options)
}

export class GoogleGeminiProvider extends LLMProvider {
    genAI: GoogleGenerativeAI;

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.genAI = new GoogleGenerativeAI(options.apiKey);
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const params = this.initParams(content.messages)

        const model = this.genAI.getGenerativeModel({
            systemInstruction: params.system,
            model: params.model,
            generationConfig: {
                temperature: params.temperature,
            }
        });

        const newMessages = params.messages

        const lastMessage = newMessages.pop()

        const chat = model.startChat({
            history: newMessages
        });

        const result = await chat.sendMessage(lastMessage?.parts || []);

        return new AssistantMessage(result.response.text())
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const params = this.initParams(content.messages)

        const model = this.genAI.getGenerativeModel(
            {
                systemInstruction: params.system,
                model: params.model,
                generationConfig: {
                    temperature: params.temperature,
                }
            },
            {
                baseUrl: params.baseUrl,
                customHeaders: params.headers
            });

        const newMessages = params.messages

        const lastMessage = newMessages.pop()

        const chat = model.startChat({
            history: newMessages
        });

        const result = await chat.sendMessageStream(lastMessage?.parts || []);

        return streamFromGoogle(result.stream, new AbortController())
    }


    initParams(messages: BaseChatMessage[]) {
        const systemMessage = messages[0]?.role === 'system' ? messages.shift() : undefined
        const system = typeof systemMessage?.content === 'string' ? systemMessage.content : ''
        const newMessages = convertMessagesToGoogleMessages(messages)
        if (newMessages.length > 0 && newMessages[0].role !== 'user') {
            newMessages.shift();
        }

        let headers = {}
        let baseUrl = 'https://generativelanguage.googleapis.com'

        let model = this.options.modelName.value


        if (this.options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "modelName": model
            }
            baseUrl = this.options.baseUrl
            model = model.split('/')[1]
        }

        return {
            system,
            model,
            temperature: this.options.temperature.value,
            max_tokens: 1024,
            messages: newMessages,
            headers,
            baseUrl
        }


    }

}