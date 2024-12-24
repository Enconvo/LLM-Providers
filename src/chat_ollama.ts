import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, res, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import { convertMessagesToAnthropicMessages, streamFromAnthropic } from "./utils/anthropic_util.ts";
import ollama from 'ollama'
import { OllamaUtil } from "./utils/ollama_util.ts";


export default function main(options: any) {
    return new OllamaProvider(options)
}

export class OllamaProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        this.anthropic = new Anthropic({
            apiKey: options.anthropicApiKey, // defaults to process.env["ANTHROPIC_API_KEY"]
        });


    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const newMessages = OllamaUtil.convertMessagesToOllamaMessages(content.messages)

        const params = this.initParams()

        const response = await ollama.chat({ ...params, messages: newMessages })

        return new AssistantMessage(response.message.content)
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const newMessages = OllamaUtil.convertMessagesToOllamaMessages(content.messages)

        const params = this.initParams()

        const response = await ollama.chat({ ...params, messages: newMessages, stream: true })

        let consumed = false;

        async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const chunk of response) {
                    if (done) continue;

                    if (chunk.done) {
                        done = true;
                        continue
                    }

                    const newChunk = new BaseChatMessageChunk({
                        content: chunk.message.content
                    })

                    yield newChunk
                }
                done = true;
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
                throw e;
            } finally {
                if (!done) response.abort();
            }
        }

        const controller = new AbortController();
        controller.signal.addEventListener('abort', () => {
            response.abort();
        });

        return new Stream(iterator, controller);

    }

    initParams() {

        return {
            model: this.options.modelName.value,
            temperature: this.options.temperature.value
        }


    }
}