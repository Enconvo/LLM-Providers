import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  LLMProvider,
  Stream,
} from "@enconvo/api";

export default function main(options: any) {
  return new MinaiProvider(options);
}

type StreamChunk = { type: "text"; text: string };

export class MinaiProvider extends LLMProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);
    this.baseUrl = options.credentials?.baseUrl || "https://api.1min.ai";
    this.apiKey = options.credentials?.apiKey;
    if (!this.apiKey) {
      throw new Error("API key is required for 1min AI provider");
    }
  }

  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    const requestPayload = this.buildRequestPayload(content);
    const response = await this.makeApiRequest(requestPayload, false, content.signal);
    const json = await response.json()

    if (json.error) {
      throw new Error(`1min AI API error: ${json.error}`);
    }

    const messageContent = this.extractResponseContent(json);
    return new AssistantMessage(messageContent);
  }

  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const requestPayload = this.buildRequestPayload(content);

    let consumed = false;
    const controller = new AbortController();

    if (content.signal) {
      content.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    async function* iterator(
      this: MinaiProvider,
    ): AsyncIterator<BaseChatMessageChunk, any, undefined> {
      if (consumed) {
        throw new Error(
          "Cannot iterate over a consumed stream, use `.tee()` to split the stream.",
        );
      }
      consumed = true;

      try {
        const response = await this.makeApiRequest(
          requestPayload,
          true,
          controller.signal,
        );

        if (!response.body) {
          throw new Error("No response body from 1min AI API");
        }

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        try {
          let runningContentBlockType:
            | BaseChatMessageChunk.ContentBlock["type"]
            | undefined;
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last potentially incomplete line in the buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              const chunks = MinaiProvider.parseStreamLine(line);
              for (const chunk of chunks) {
                if (
                  !runningContentBlockType ||
                  runningContentBlockType !== "text"
                ) {
                  runningContentBlockType = "text";
                  yield {
                    type: "content_block_start",
                    content_block: { type: "text", text: "" },
                  };
                }
                yield {
                  type: "content_block_delta",
                  delta: { type: "text_delta", text: chunk.text },
                };
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const chunks = MinaiProvider.parseStreamLine(buffer);
            for (const chunk of chunks) {
              if (
                !runningContentBlockType ||
                runningContentBlockType !== "text"
              ) {
                runningContentBlockType = "text";
                yield {
                  type: "content_block_start",
                  content_block: { type: "text", text: "" },
                };
              }
              yield {
                type: "content_block_delta",
                delta: { type: "text_delta", text: chunk.text },
              };
            }
          }
        } finally {
          reader.releaseLock();
          yield { type: "content_block_stop" };
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      }
    }

    return new Stream(iterator.bind(this), controller);
  }

  /**
   * Parse a single stream line, handling both SSE format and raw text.
   */
  private static parseStreamLine(line: string): StreamChunk[] {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") return [];

    // SSE format: "data: {...}"
    if (trimmed.startsWith("data: ")) {
      const data = trimmed.slice(6);
      try {
        const parsed = JSON.parse(data);

        // OpenAI-compatible streaming format
        const delta = parsed.choices?.[0]?.delta;
        if (delta) {
          if (delta.content) {
            return [{ type: "text", text: delta.content }];
          }
          return [];
        }

        // Direct content fields
        if (parsed.content) return [{ type: "text", text: parsed.content }];
        if (parsed.text) return [{ type: "text", text: parsed.text }];
        if (typeof parsed === "string") return [{ type: "text", text: parsed }];

        return [];
      } catch {
        // Not valid JSON after "data: " - treat as raw text
        return data ? [{ type: "text", text: data }] : [];
      }
    }

    // Raw text line
    return [{ type: "text", text: trimmed }];
  }

  private buildRequestPayload(content: LLMProvider.Params) {
    const messages = content.messages || [];
    const modelName = this.options.modelName?.value || "gpt-4o-mini";

    const prompt = this.formatMessagesAsPrompt(messages);

    const promptObject: any = {
      prompt,
      isMixed: false,
      webSearch: false,
      numOfSite: 0,
    };

    console.log("obj", promptObject)
    return {
      type: "CHAT_WITH_AI",
      model: modelName,
      promptObject,
    };
  }

  private formatMessagesAsPrompt(messages: BaseChatMessageLike[]): string {
    if (messages.length === 0) return "";

    console.log("messages", JSON.stringify(messages, null, 2))
    const parts: string[] = [];
    for (const msg of messages) {
      const role = msg.role;
      if (role === "system") {
        parts.push('System Instruction:\n')
      } else if (role === 'user') {
        parts.push('User Message:\n')
      } else if (role === 'assistant') {
        parts.push('Assistant Message:\n')
      }
      for (const msgContent of msg.content) {
        if (msgContent.type === 'text') {
          parts.push(msgContent.text);
        } else {
          parts.push('raw content:' + JSON.stringify(msgContent))
        }
      }
    }

    return parts.join("\n\n");
  }


  private async makeApiRequest(
    payload: any,
    isStreaming: boolean,
    signal?: AbortSignal,
  ) {
    const endpoint = isStreaming
      ? `${this.baseUrl}/api/features?isStreaming=true`
      : `${this.baseUrl}/api/features`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`1min AI API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  private extractResponseContent(response: any): string {
    if (response.aiRecord?.aiRecordDetail?.resultObject) {
      const result = response.aiRecord.aiRecordDetail.resultObject;
      if (typeof result === "string") return result;
      if (Array.isArray(result) && result.length > 0) return result[0];
    }
    return response.content || response.message || "";
  }
}
