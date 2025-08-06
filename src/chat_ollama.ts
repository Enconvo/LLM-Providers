import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, uuid } from "@enconvo/api";
import { Ollama } from 'ollama'
import { OllamaUtil } from "./utils/ollama_util.ts";


export default function main(options: any) {
    return new OllamaProvider(options)
}

export class OllamaProvider extends LLMProvider {
    ollama: Ollama

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.ollama = new Ollama({ host: options.baseUrl })
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const newMessages = OllamaUtil.convertMessagesToOllamaMessages(content.messages)

        const params = this.initParams()

        const response = await this.ollama.chat({ ...params, messages: newMessages })

        return new AssistantMessage(response.message.content)
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const newMessages = OllamaUtil.convertMessagesToOllamaMessages(content.messages)

        const params = this.initParams()

        const response = await this.ollama.chat({ ...params, messages: newMessages, stream: true })

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

                    const newChunk: BaseChatMessageChunk = {
                        model: "Ollama",
                        id: uuid(),
                        choices: [{
                            delta: {
                                content: chunk.message.content,
                                role: "assistant"
                            },
                            finish_reason: null,
                            index: 0
                        }],
                        created: Date.now(),
                        object: "chat.completion.chunk"
                    }

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