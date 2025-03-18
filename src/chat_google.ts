import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, LLMProvider, Stream } from "@enconvo/api";
import { FunctionCallingMode, GoogleGenerativeAI } from "@google/generative-ai";
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
                toolConfig: params.toolConfig,
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
        const userMessages = content.messages.filter((message) => message.role !== 'system')
        const systemMessages = content.messages.filter((message) => message.role === 'system')

        const system = systemMessages.length > 0 ? systemMessages.map((message) => {
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
        console.log("tools", content.tools)

        const tools = GoogleUtil.convertToolsToGoogleTools(content.tools)
        let toolConfig = {}
        if (typeof content.tool_choice === "object") {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingMode.ANY,
                    allowedFunctionNames: [content.tool_choice.function.name]
                }
            }
        } else {
            toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingMode.AUTO
                }
            }
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
            toolConfig
        }

    }

}