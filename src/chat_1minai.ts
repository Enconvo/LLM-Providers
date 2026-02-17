import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
  uuid,
} from "@enconvo/api";
import { MinaiUtil } from "./utils/minai_util.ts";

export default function main(options: any) {
  return new MinaiProvider(options);
}

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
    const requestPayload = this.buildRequestPayload(content, false);

    const response = await this.makeApiRequest(requestPayload, false);

    if (response.error) {
      throw new Error(`1min AI API error: ${response.error}`);
    }

    // Extract response content from the 1min AI response format
    const messageContent = this.extractResponseContent(response);
    return new AssistantMessage(messageContent);
  }

  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const requestPayload = this.buildRequestPayload(content, true);

    let consumed = false;
    const controller = new AbortController();

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
          let runningContentBlockType: BaseChatMessageChunk.ContentBlock['type'] | undefined;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.trim() === "") continue;

              try {
                // 1min AI streaming response is plain text, not SSE format
                const content = line;
                if (content) {
                  if (!runningContentBlockType) {
                    runningContentBlockType = 'text';
                    yield {
                      type: 'content_block_start',
                      content_block: {
                        type: runningContentBlockType,
                        text: '',
                      }
                    }
                  }

                  yield {
                    type: 'content_block_delta',
                    delta: {
                      type: 'text_delta',
                      text: content,
                    }
                  }

                }
              } catch (e) {
                // Skip invalid lines
                console.warn("Failed to parse 1min AI stream chunk:", e);
              }
            }
          }
        } finally {
          reader.releaseLock();
          yield {
            type: 'content_block_stop',
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      }
    }

    controller.signal.addEventListener("abort", () => {
      // Cleanup will be handled in the iterator
    });

    return new Stream(iterator.bind(this), controller);
  }

  private buildRequestPayload(
    content: LLMProvider.Params,
    isStreaming: boolean,
  ) {
    const messages = MinaiUtil.convertMessagesToMinaiMessages(content.messages);
    const modelName = this.options.modelName?.value || "gpt-4o-mini";

    // Build the 1min AI specific request format
    const promptObject: any = {
      prompt: messages[messages.length - 1]?.content || "",
      isMixed: false,
      webSearch: false,
      numOfSite: 1,
      maxWord: 500,
    };

    // Add image support if available
    if (content.messages) {
      const imageList = MinaiUtil.extractImagesFromMessages(content.messages);
      if (imageList.length > 0) {
        promptObject.imageList = imageList;
      }
    }

    return {
      type: this.getFeatureType(content),
      model: modelName,
      promptObject: promptObject,
    };
  }

  private getFeatureType(content: LLMProvider.Params): string {
    // Determine feature type based on message content
    const hasImages = content.messages?.some(
      (msg) =>
        Array.isArray(msg.content) &&
        msg.content.some(
          (item) => typeof item === "object" && "image_url" in item,
        ),
    );

    if (hasImages) {
      return "CHAT_WITH_IMAGE";
    }

    return "CHAT_WITH_AI";
  }

  private async makeApiRequest(
    payload: any,
    isStreaming: boolean,
    signal?: AbortSignal,
  ) {
    const endpoint = isStreaming
      ? `${this.baseUrl}/api/features?isStreaming=true`
      : `${this.baseUrl}/api/features`;

    const headers: Record<string, string> = {
      "API-KEY": this.apiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal: signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `1min AI API request failed with status ${response.status}: ${errorText}`,
      );
    }

    if (isStreaming) {
      return response;
    } else {
      return await response.json();
    }
  }

  private extractResponseContent(response: any): string {
    // Extract content from 1min AI response format
    if (response.aiRecord?.aiRecordDetail?.resultObject) {
      const resultObject = response.aiRecord.aiRecordDetail.resultObject;
      if (typeof resultObject === "string") {
        return resultObject;
      }
      if (Array.isArray(resultObject) && resultObject.length > 0) {
        return resultObject[0];
      }
    }

    if (response.content) {
      return response.content;
    }

    if (response.message) {
      return response.message;
    }

    return "";
  }
}
