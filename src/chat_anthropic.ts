import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicUtil, convertMessagesToAnthropicMessages, streamFromAnthropic } from "./utils/anthropic_util.ts";
import { env } from "process";

export default function main(options: any) {
    return new AnthropicProvider(options)
}

export class AnthropicProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        let headers = {
        }

        if (options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "commandTitle": `${env['commandTitle']}`,
                "modelName": options.modelName.value
            }
        }

        this.anthropic = new Anthropic({
            apiKey: options.anthropicApiKey, // defaults to process.env["ANTHROPIC_API_KEY"]
            baseURL: options.anthropicApiUrl,
            defaultHeaders: headers
        });
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {

        const params = this.initParams(content)
        let msg: any
        const model = this.options.modelName.value
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            msg = await this.anthropic.beta.messages.create({
                ...params,
                stream: false
            });
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

        const params = this.initParams(content)

        let stream: any
        const model = this.options.modelName.value
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            stream = this.anthropic.beta.messages.stream(params)
        } else {
            stream = this.anthropic.messages.stream(params)
        }

        return streamFromAnthropic(stream, stream.controller)
    }

    initParams(content: LLMProvider.Params): any {
        const messages = content.messages
        const systemMessage = messages[0]?.role === 'system' ? messages.shift() : undefined
        const system = typeof systemMessage?.content === 'string' ? systemMessage.content : ''
        const tools = AnthropicUtil.convertToolsToAnthropicTools(content.tools)

        const newMessages = convertMessagesToAnthropicMessages(messages, this.options)

        const model = this.options.modelName.value
        console.log("system", model)
        let params: any = {}
        if (model.includes("claude-3-7-sonnet-latest-thinking")) {
            const modelName = model.includes("anthropic/") ? "anthropic/claude-3-7-sonnet-20250219" : "claude-3-7-sonnet-20250219"

            params = {
                system,
                model: modelName,
                max_tokens: 128000,
                thinking: {
                    type: "enabled",
                    budget_tokens: 32000
                },
                messages: newMessages,
                temperature: this.options.temperature.value,
                betas: ["output-128k-2025-02-19"]
            }
        } else {
            params = {
                system,
                model: model,
                temperature: this.options.temperature.value,
                max_tokens: this.options.modelName.maxTokens || 8192,
                messages: newMessages,
            }

            if (tools && tools.length > 0) {
                params.tools = tools
                params.tool_choice = {
                    type: "auto",
                    disable_parallel_tool_use: true
                }
            }
        }


        return params
    }
}