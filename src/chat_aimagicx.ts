import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, uuid } from "@enconvo/api";
import { AimagicxUtil } from "./utils/aimagicx_util.ts";

export default function main(options: any) {
    return new AimagicxProvider(options)
}

export class AimagicxProvider extends LLMProvider {
    private baseUrl: string;
    private apiKey: string;

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.baseUrl = options.credentials?.baseUrl || "https://beta.aimagicx.com/api/v1"
        this.apiKey = options.credentials?.apiKey
        if (!this.apiKey) {
            throw new Error("API key is required for Aimagicx provider")
        }
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const messages = AimagicxUtil.convertMessagesToOpenAIMessages(content.messages)
        const params = this.initParams(content, false)

        const response = await this.makeApiRequest(params, messages, false)
        
        if (!response.choices || response.choices.length === 0) {
            throw new Error("No response from Aimagicx API")
        }

        const messageContent = response.choices[0].message?.content || ""
        return new AssistantMessage(messageContent)
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const messages = AimagicxUtil.convertMessagesToOpenAIMessages(content.messages)
        const params = this.initParams(content, true)

        let consumed = false;
        const controller = new AbortController();

        async function* iterator(this: AimagicxProvider): AsyncIterator<BaseChatMessageChunk, any, undefined> {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;

            try {
                const response = await this.makeApiRequest(params, messages, true, controller.signal);
                
                if (!response.body) {
                    throw new Error("No response body from Aimagicx API")
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') break;

                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.choices && parsed.choices[0]?.delta?.content) {
                                        const newChunk: BaseChatMessageChunk = {
                                            model: this.options.modelName.value,
                                            id: parsed.id || uuid(),
                                            choices: [{
                                                delta: {
                                                    content: parsed.choices[0].delta.content,
                                                    role: "assistant"
                                                },
                                                finish_reason: parsed.choices[0].finish_reason || null,
                                                index: 0
                                            }],
                                            created: parsed.created || Date.now(),
                                            object: "chat.completion.chunk"
                                        }
                                        yield newChunk;
                                    }
                                } catch (e) {
                                    // Skip invalid JSON lines
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
                throw e;
            }
        }

        controller.signal.addEventListener('abort', () => {
            // Cleanup will be handled in the iterator
        });

        return new Stream(iterator.bind(this), controller);
    }

    private initParams(content: LLMProvider.Params, stream: boolean) {
        let temperature = this.options.temperature?.value || 0.7;
        if (typeof temperature === "string") {
            temperature = parseFloat(temperature);
        }

        const params: any = {
            model: this.options.modelName?.value || "4o-mini",
            temperature: temperature,
            stream: stream
        }

        if (this.options.maxTokens?.value) {
            params.max_tokens = this.options.maxTokens.value;
        }

        // Handle tools if supported
        const tools = AimagicxUtil.convertToolsToOpenAITools(content.tools);
        if (tools && tools.length > 0) {
            params.tools = tools;
            if (content.tool_choice) {
                params.tool_choice = content.tool_choice;
            }
        }

        return params;
    }

    private async makeApiRequest(params: any, messages: any[], stream: boolean, signal?: AbortSignal) {
        const requestBody = {
            ...params,
            messages: messages
        };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Aimagicx API request failed with status ${response.status}: ${errorText}`);
        }

        if (stream) {
            return response;
        } else {
            return await response.json();
        }
    }
}