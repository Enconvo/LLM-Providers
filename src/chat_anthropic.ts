import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicUtil, convertMessagesToAnthropicMessages, streamFromAnthropic } from "./utils/anthropic_util.ts";
import { env } from "process";

import { wrapSDK } from "langsmith/wrappers";

export default function main(options: any) {
    return new AnthropicProvider(options)
}

export class AnthropicProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        let headers = {}

        if (options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "commandTitle": `${env['commandTitle']}`,
                "modelName": options.modelName.value
            }
        }

        const credentials = options.credentials
        console.log("anthropic credentials", credentials)

        const anthropic = new Anthropic({
            apiKey: credentials.anthropicApiKey,
            baseURL: credentials.anthropicApiUrl,
            defaultHeaders: headers
        });


        if (env['LANGCHAIN_TRACING_V2'] === 'true') {
            this.anthropic = wrapSDK(anthropic)
        } else {
            this.anthropic = anthropic
        }
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {

        const params = await this.initParams(content)
        let msg: any
        const model = this.options.modelName.value
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            const stream = this.anthropic.beta.messages.stream(params);
            let text = ""
            for await (const chunk of stream) {
                if (chunk.type === "content_block_delta") {
                    if (chunk.delta.type === "text_delta") {
                        text += chunk.delta.text
                    }
                }
            }
            return new AssistantMessage(text)
        } else {
            msg = await this.anthropic.messages.create({
                ...params,
                stream: false
            });
        }

        if (msg.content[0]?.type === "text") {
            return new AssistantMessage(msg.content[0].text)
        }

        return new AssistantMessage(msg.content[0].type)
    }


    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const credentials = this.options.credentials
        if (!credentials.anthropicApiKey) {
            throw new Error("Anthropic API key is required")
        }

        const params = await this.initParams(content)

        let stream: any
        const model = this.options.modelName.value
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            stream = this.anthropic.messages.stream(params)
        } else {
            stream = this.anthropic.messages.stream(params)
        }

        return streamFromAnthropic(stream, stream.controller)
    }

    async initParams(content: LLMProvider.Params): Promise<any> {
        const messages = content.messages
        const systemMessages = messages.filter((message) => message.role === "system")
        const system = systemMessages.map((message) => {
            if (typeof message.content === "string") {
                return {
                    type: "text",
                    text: message.content
                }
            } else {
                return message.content.map((content) => {
                    if (content.type === "text") {
                        return {
                            type: "text",
                            text: content.text
                        }
                    }
                })
            }
        })

        const conversationMessages = messages.filter((message) => message.role !== "system")

        const tools = AnthropicUtil.convertToolsToAnthropicTools(content.tools)

        const newMessages = await convertMessagesToAnthropicMessages(conversationMessages, this.options)


        const model = this.options.modelName.value
        let params: any = {}
        let temperature = Number(this.options.temperature.value)
        if (temperature > 1) {
            temperature = 1
        }
        if (temperature < 0) {
            temperature = 0
        }
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            const modelName = model.includes("anthropic/") ? "anthropic/claude-3-7-sonnet-20250219" : "claude-3-7-sonnet-20250219"

            params = {
                system,
                model: modelName,
                max_tokens: 64000,
                thinking: {
                    type: "enabled",
                    budget_tokens: 32000
                },
                messages: newMessages,
                temperature: temperature,
            }
        } else {
            const defaultMaxTokens = model.includes("claude-3-7-sonnet") ? 64000 : this.options.modelName.maxTokens || 8192

            params = {
                system,
                model: model,
                temperature: temperature,
                max_tokens: defaultMaxTokens,
                messages: newMessages,
            }

            if (tools && tools.length > 0) {
                params.tools = tools
                if (content.tool_choice && typeof content.tool_choice !== "string") {
                    params.tool_choice = {
                        type: "tool",
                        name: content.tool_choice.function.name,
                        disable_parallel_tool_use: true
                    }

                } else {

                    params.tool_choice = {
                        type: "auto",
                        disable_parallel_tool_use: true
                    }
                }
            }
        }

        return params
    }
}