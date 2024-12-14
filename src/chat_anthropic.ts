import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import { convertMessagesToAnthropicMessages, convertMessageToAnthropicMessage, streamFromAnthropic } from "./utils/anthropic_util.ts";

export default function main(options: any) {
    return new AnthropicOpenAIProvider(options)
}

export class AnthropicOpenAIProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        this.anthropic = new Anthropic({
            apiKey: options.anthropicApiKey, // defaults to process.env["ANTHROPIC_API_KEY"]
        });


    }

    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {

        const msg = await this.anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello, Claude" }],
        });
        console.log(msg);
        throw new Error("Method not implemented.");
    }

    protected async _stream(content: { messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {
        // get system message from messages
        console.log("content", JSON.stringify(content))

        const systemMessage = content.messages[0]?.role === 'system' ? content.messages.shift() : undefined
        const system = typeof systemMessage?.content === 'string' ? systemMessage.content : ''



        const stream = this.anthropic.messages.stream({
            system,
            model: this.options.modelName.value,
            temperature: this.options.temperature.value,
            max_tokens: 1024,
            messages: convertMessagesToAnthropicMessages(content.messages),
        });

        return streamFromAnthropic(stream, stream.controller)

    }



}