import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, LLMProvider, Stream } from "@enconvo/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { convertMessagesToGoogleMessages, GoogleUtil, streamFromGoogle } from "./utils/google_util.ts";
import { env } from "process";

export default function main(options: any) {
    return new GoogleGeminiProvider(options)
}

export class GoogleGeminiProvider extends LLMProvider {
    genAI: GoogleGenerativeAI;

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        console.log("options google", options)
        this.genAI = new GoogleGenerativeAI(options.apiKey);
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const params = this.initParams(content)

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

        const params = this.initParams(content)

        console.log("params", params)
        // for await (const chunk of result.stream) {
        //     const chunkText = chunk.text();
        //     process.stdout.write(chunkText);
        // }



        const model = this.genAI.getGenerativeModel(
            {
                systemInstruction: params.system,
                model: params.model,
                tools: params.tools,
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



    initParams(content: LLMProvider.Params) {
        const messages = content.messages

        const systemMessage = messages[0]?.role === 'system' ? messages.shift() : undefined

        const system = typeof systemMessage?.content === 'string' ? systemMessage.content : ''

        function makeFirstMessageBeUserRole(messages: BaseChatMessageLike[]) {
            if (messages.length > 0 && messages[0].role !== 'user') {
                messages.shift();
            }

            if (messages.length > 0 && messages[0].role !== 'user') {
                return makeFirstMessageBeUserRole(messages);
            }

            return messages
        }


        const fixedMessages = makeFirstMessageBeUserRole(messages)

        let newMessages = convertMessagesToGoogleMessages(fixedMessages, this.options)



        let headers = {}
        let baseUrl = this.options.baseUrl

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

        const tools = GoogleUtil.convertToolsToGoogleTools(content.tools)

        return {
            system,
            model,
            temperature: this.options.temperature.value,
            max_tokens: 1024,
            messages: newMessages,
            headers,
            baseUrl,
            tools
        }

    }

}