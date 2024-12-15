import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import { convertMessagesToAnthropicMessages, streamFromAnthropic } from "./utils/anthropic_util.ts";
import { env } from "process";


export default function main(options: any) {
    return new AnthropicProvider(options)
}

export class AnthropicProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        console.log("AnthropicProvider", options)

        let headers = {
        }

        if (options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`
            }
        }

        this.anthropic = new Anthropic({
            apiKey: options.anthropicApiKey, // defaults to process.env["ANTHROPIC_API_KEY"]
            baseURL: options.anthropicApiUrl,
            defaultHeaders: headers
        });
    }

    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {

        const msg = await this.anthropic.messages.create(this.initParams(content.messages));

        if (msg.content[0]?.type === "text") {
            return new AssistantMessage(msg.content[0].text)
        }

        return new AssistantMessage(msg.content[0].type)
    }

    protected async _stream(content: { messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {

        const stream = this.anthropic.messages.stream(this.initParams(content.messages));

        return streamFromAnthropic(stream, stream.controller)

    }

    initParams(messages: BaseChatMessage[]) {
        const systemMessage = messages[0]?.role === 'system' ? messages.shift() : undefined
        const system = typeof systemMessage?.content === 'string' ? systemMessage.content : ''

        return {
            system,
            model: this.options.modelName.value,
            temperature: this.options.temperature.value,
            max_tokens: 1024,
            messages: convertMessagesToAnthropicMessages(messages),
        }


    }
}