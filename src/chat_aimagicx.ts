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
            throw new Error("API key is required for AIMagicX provider")
        }
        if (!AimagicxUtil.validateApiKey(this.apiKey)) {
            console.warn("API key format may be invalid for AIMagicX provider")
        }
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const messageData = AimagicxUtil.convertMessagesToSingleMessage(content.messages)
        const params = this.buildRequestParams(content, false, messageData)

        const response = await this.makeApiRequest(params, false)

        // Handle the actual API response format: { success: true, data: { choices: [...] } }
        const responseData = response.success ? response.data : response;
        
        if (!responseData.choices || responseData.choices.length === 0) {
            throw new Error("No response from AIMagicX API")
        }

        const messageContent = responseData.choices[0].message?.content || ""
        return new AssistantMessage(messageContent)
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const messageData = AimagicxUtil.convertMessagesToSingleMessage(content.messages)
        const params = this.buildRequestParams(content, true, messageData)

        let consumed = false;
        const controller = new AbortController();

        async function* iterator(this: AimagicxProvider): AsyncIterator<BaseChatMessageChunk, any, undefined> {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;

            try {
                const response = await this.makeApiRequest(params, true, controller.signal);

                if (!response.body) {
                    throw new Error("No response body from AIMagicX API")
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');

                        // Keep incomplete line in buffer
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() === '') continue;

                            if (line.startsWith('data: ')) {
                                const data = line.slice(6).trim();
                                if (data === '[DONE]') return;

                                try {
                                    const parsed = JSON.parse(data);

                                    // Handle content chunks
                                    if (parsed.choices?.[0]?.delta?.content) {
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
                                            created: parsed.created || Math.floor(Date.now() / 1000),
                                            object: "chat.completion.chunk"
                                        }
                                        yield newChunk;
                                    }

                                    // Handle tool calls
                                    if (parsed.choices?.[0]?.delta?.tool_calls) {
                                        const toolCalls = parsed.choices[0].delta.tool_calls;
                                        const toolCallChunk: BaseChatMessageChunk = {
                                            model: this.options.modelName.value,
                                            id: parsed.id || uuid(),
                                            choices: [{
                                                delta: {
                                                    tool_calls: toolCalls,
                                                    role: "assistant"
                                                },
                                                finish_reason: parsed.choices[0].finish_reason || null,
                                                index: 0
                                            }],
                                            created: parsed.created || Math.floor(Date.now() / 1000),
                                            object: "chat.completion.chunk"
                                        }
                                        yield toolCallChunk;
                                    }
                                } catch (e) {
                                    // Skip invalid JSON lines
                                    console.debug('Failed to parse SSE data:', data);
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

    private buildRequestParams(content: LLMProvider.Params, stream: boolean, messageData: { message: string, system?: string }): any {
        let temperature = this.options.temperature?.value || 0.7;
        if (typeof temperature === "string") {
            temperature = parseFloat(temperature);
        }

        const params: any = {
            message: messageData.message,
            model: this.options.modelName?.value || "4o-mini",
            temperature: temperature,
            stream: stream
        }

        // Add system message if present
        if (messageData.system) {
            params.system = messageData.system;
        }

        // Handle maxTokens (AIMagicX uses maxTokens, not max_tokens)
        if (this.options.maxTokens?.value) {
            params.maxTokens = this.options.maxTokens.value;
        }

        // Handle tools - AIMagicX uses simple string array
        const tools = AimagicxUtil.convertToolsToAimagicxTools(content.tools);
        if (tools && tools.length > 0) {
            params.tools = tools;
        }

        // Additional parameters supported by AIMagicX API
        // Note: topP, frequencyPenalty, presencePenalty, and stop are supported by the API
        // but not exposed through the current LLMProvider.Params interface
        // These would need to be passed through options or extended interface

        return params;
    }

    private async makeApiRequest(params: any, stream: boolean, signal?: AbortSignal) {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json; charset=utf-8'
        };

        if (stream) {
            headers['Accept'] = 'text/event-stream';
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(params),
                signal: signal
            });
            console.log("params", JSON.stringify(params, null, 2), headers)

            if (!response.ok) {
                let errorMessage: string;
                try {
                    const errorData = await response.json();
                    errorMessage = AimagicxUtil.formatApiError(errorData);
                } catch {
                    errorMessage = await response.text();
                }
                throw new Error(`AIMagicX API request failed with status ${response.status}: ${errorMessage}`);
            }

            if (stream) {
                return response;
            } else {
                return await response.json();
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`AIMagicX API error: ${error.message}`);
            }
            throw error;
        }
    }
}