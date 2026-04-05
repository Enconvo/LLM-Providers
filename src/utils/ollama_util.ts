import { AITool, AttachmentUtils, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, Runtime, Stream } from "@enconvo/api";
import { AbortableAsyncIterator, ChatResponse, Message, Tool, ToolCall } from "ollama";


export namespace OllamaUtil {

  export const convertAIToolsToOllamaTools = (
    tools?: AITool[],
  ): Tool[] | undefined => {
    if (!tools) {
      return undefined;
    }

    return tools.map((tool) => {
      const parameters = (
        tool.parameters?.type !== undefined &&
        tool.parameters?.properties !== undefined
      )
        ? tool.parameters
        : { type: "object" as const, properties: {}, required: [] as string[] };

      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters,
        }
      };
    });
  };

  /**
   * Converts an Ollama `AbortableAsyncIterator<ChatResponse>` into the unified
   * Anthropic-like `Stream<BaseChatMessageChunk>` format consumed by the
   * LLMProvider stream handler in enconvo.nodejs.
   *
   * Stream format contract (matches Anthropic SSE):
   *   content_block_start → content_block_delta* → content_block_stop
   *   (repeated per block: thinking, text, tool_use)
   *   usage (once, from the final done chunk)
   *
   * The consumer (`LLMProvider.handleAgentMessages`) processes one tool at a
   * time in an agent loop, so only the first tool_call per chunk is emitted.
   */
  export const streamFromOllama = (
    response: AbortableAsyncIterator<ChatResponse>,
  ): Stream<BaseChatMessageChunk> => {
    let consumed = false;

    async function* iterator(): AsyncIterator<
      BaseChatMessageChunk,
      any,
      undefined
    > {
      if (consumed) {
        throw new Error(
          "Cannot iterate over a consumed stream, use `.tee()` to split the stream.",
        );
      }
      consumed = true;
      let done = false;
      let doneReason: string | undefined;
      let runningContentBlockType: BaseChatMessageChunk.ContentBlock['type'] | undefined;

      function* stopCurrentBlock(finishReason?: BaseChatMessageChunk.ContentBlockStop['finish_reason']) {
        if (runningContentBlockType !== undefined) {
          yield {
            type: 'content_block_stop' as const,
            ...(finishReason ? { finish_reason: finishReason } : {}),
          };
          runningContentBlockType = undefined;
        }
      }

      try {
        for await (const chunk of response) {
          console.log('chunk', done, chunk)
          if (done) continue;

          if (chunk.done) {
            done = true;
            doneReason = chunk.done_reason;
            const ollamaChunk = chunk as any;
            const promptEvalCount = ollamaChunk.prompt_eval_count || 0;
            const evalCount = ollamaChunk.eval_count || 0;
            if (promptEvalCount > 0 || evalCount > 0) {
              yield {
                type: 'usage' as const,
                usage: {
                  input_tokens: promptEvalCount,
                  output_tokens: evalCount,
                  total_tokens: promptEvalCount + evalCount,
                }
              };
            }
            continue;
          }

          // Handle tool calls (first call only — consumer processes one tool per agent step)
          if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
            yield* stopCurrentBlock();
            runningContentBlockType = 'tool_use';

            const toolFunction = chunk.message.tool_calls[0].function;
            yield {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                name: toolFunction.name,
                input: toolFunction.arguments || {},
                id: ''
              }
            };
            continue;
          }

          // Handle native thinking field (Ollama SDK >=0.6, uses message.thinking)
          if (chunk.message.thinking) {
            if (runningContentBlockType !== 'thinking') {
              yield* stopCurrentBlock();
              runningContentBlockType = 'thinking';
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'thinking',
                  thinking: '',
                }
              };
            }
            yield {
              type: 'content_block_delta',
              delta: {
                type: 'thinking_delta',
                thinking: chunk.message.thinking,
              }
            };
            continue;
          }

          // Handle content (with fallback <think> tag parsing for older Ollama versions)
          if (chunk.message.content && chunk.message.content !== '') {
            console.log('runningContentBlockType', runningContentBlockType, (runningContentBlockType !== 'text'))
            if (runningContentBlockType !== 'text') {
              yield* stopCurrentBlock();
              runningContentBlockType = 'text';
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'text',
                  text: '',
                }
              };
            }
            yield {
              type: 'content_block_delta',
              delta: {
                type: 'text_delta',
                text: chunk.message.content,
              }
            };
          }
        }
        done = true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      } finally {
        // Map Ollama done_reason "length" → finish_reason "max_tokens"
        // so the consumer's continuation loop can request more output.
        const finishReason = doneReason === 'length' ? 'max_tokens' : undefined;
        yield* stopCurrentBlock(finishReason);
        if (!done) response.abort();
      }
    }

    const controller = new AbortController();
    controller.signal.addEventListener("abort", () => {
      response.abort();
    });

    return new Stream(iterator, controller);
  };

  export const convertMessageToOllamaMessage = async (
    message: BaseChatMessageLike,
    options: LLMProvider.LLMOptions,
  ): Promise<Message[]> => {
    if (typeof message.content === "string") {
      return [{
        role: message.role,
        content: message.content,
      }];
    } else {
      const images = (
        await Promise.all(
          message.content
            .filter((item) => item.type === "image_url")
            .map(async (item) => {
              if (item.type === "image_url") {
                const url = item.image_url.url.replace("file://", "");
                if (options.modelName.visionEnable === true) {
                  const base64 = await FileUtil.convertUrlToBase64(url);
                  return base64;
                }
              }
              return null;
            }),
        )
      ).filter((item) => item !== null);


      let toolCall: ToolCall | undefined;
      const flowStep = message.content.find((item) => item.type === "flow_step")
      const isAgentMode = Runtime.isAgentMode();
      const textParts: string[] = [];

      for (const item of message.content) {
        if (item.type === "text") {
          textParts.push(item.text);
        } else if (item.type === "audio") {
          const url = item.file_url.url.replace("file://", "");
          const readableContent = isAgentMode
            ? []
            : await AttachmentUtils.getAttachmentsReadableContent({
              files: [url],
              loading: true,
            });

          if (readableContent.length > 0) {
            const text = readableContent[0].contents
              .map((item) => item.text)
              .join("\n");
            textParts.push(`# audio file url: ${url}\n # audio file transcript: ${text}`);
          } else {
            textParts.push(
              `This is a audio file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            );
          }
        } else if (item.type === "video") {
          const url = item.file_url.url.replace("file://", "");
          const readableContent = isAgentMode
            ? []
            : await AttachmentUtils.getAttachmentsReadableContent({
              files: [url],
              loading: true,
            });

          if (readableContent.length > 0) {
            const text = readableContent[0].contents
              .map((item) => item.text)
              .join("\n");
            textParts.push(`# video file url: ${url}\n # video file transcript: ${text}`);
          } else {
            textParts.push(
              `This is a video file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            );
          }
        } else if (item.type === "file") {
          const url = item.file_url.url.replace("file://", "");
          const readableContent = isAgentMode
            ? []
            : await AttachmentUtils.getAttachmentsReadableContent({
              files: [url],
              loading: true,
            });

          if (readableContent.length > 0) {
            const text = readableContent[0].contents
              .map((item) => item.text)
              .join("\n");
            textParts.push(`# file url: ${url}\n # file content: ${text}`);
          } else {
            textParts.push(
              `This is a file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            );
          }
        }
      }

      const text = textParts.join("\n");

      // Extract thinking content from assistant messages for multi-turn context
      let thinkingContent: string | undefined;
      if (message.role === 'assistant') {
        const thinkingParts = message.content
          .filter((item): item is { type: 'thinking'; thinkingContent: string } => item.type === 'thinking')
          .map((item) => item.thinkingContent)
          .filter(Boolean);
        if (thinkingParts.length > 0) {
          thinkingContent = thinkingParts.join("\n");
        }
      }

      const messages: Message[] = [];
      const newMessage: Message = {
        role: message.role,
        content: text,
        ...(thinkingContent ? { thinking: thinkingContent } : {}),
      }
      if (images && images.length > 0) {
        newMessage.images = images
      }


      if (flowStep) {
        const toolName = flowStep.flowName.replace("|", "--");
        try {
          toolCall = {
            function: {
              name: toolName,
              arguments: JSON.parse(flowStep.flowParams || "{}"),
            }
          }
          newMessage.tool_calls = [toolCall];
          messages.push(newMessage);
        } catch (e) {
        }

        const toolCallResult = `\n\n this is tool call result: ${JSON.stringify(flowStep.flowResults)}`;
        messages.push({
          role: 'tool',
          content: toolCallResult,
          tool_name: toolName,
        });
      } else {
        messages.push(newMessage);
      }

      return messages;
    }
  };

  export const convertMessagesToOllamaMessages = async (
    messages: BaseChatMessageLike[],
    options: LLMProvider.LLMOptions,
  ): Promise<Message[]> => {
    const newMessages = (await Promise.all(messages.map(async (message) => {
      return await convertMessageToOllamaMessage(message, options)
    }))).flat();

    // console.log("ollama  newMessages", JSON.stringify(newMessages, null, 2));
    return newMessages;
  };


}
