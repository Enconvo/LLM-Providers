import { AITool, AttachmentUtils, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, Runtime, Stream } from "@enconvo/api";
import { AbortableAsyncIterator, ChatResponse, Message, Tool, ToolCall } from "ollama";


export namespace OllamaUtil {

  export const convertAIToolsToOllamaTools = (
    tools?: AITool[],
  ): Tool[] | undefined => {
    if (!tools) {
      return undefined;
    }

    let newTools: Tool[] | undefined = tools?.map((tool) => {
      if (
        tool.parameters === undefined ||
        tool.parameters?.type === undefined ||
        tool.parameters?.properties === undefined
      ) {
        tool.parameters = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      const newTool: Tool = {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }
      };
      return newTool;
    });

    return newTools;
  };

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
      let runningContentBlockType: BaseChatMessageChunk.ContentBlock['type'] | undefined;
      try {
        for await (const chunk of response) {
          // console.log("ollama chunk", JSON.stringify(chunk, null, 2));
          if (done) continue;

          if (chunk.done) {
            done = true;
            continue;
          }
          if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {

            if (runningContentBlockType !== 'tool_use') {
              if (runningContentBlockType !== undefined) {
                yield {
                  type: 'content_block_stop',
                }
              }
              runningContentBlockType = 'tool_use';
            }

            const toolCall = chunk.message.tool_calls[0];
            const toolFunction = toolCall.function;
            yield {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                name: toolFunction.name,
                input: toolFunction.arguments || {},
                id: ''
              }
            }
          } else if (chunk.message.content && chunk.message.content !== '') {

            if (chunk.message.content === "<think>") {
              if (runningContentBlockType !== 'thinking') {
                if (runningContentBlockType !== undefined) {
                  yield {
                    type: 'content_block_stop',
                  }
                }
              }
              runningContentBlockType = 'thinking';
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'thinking',
                  thinking: '',
                }
              }

            } else if (chunk.message.content === "</think>") {
              runningContentBlockType = undefined;
              yield {
                type: 'content_block_stop',
              }
            } else {
              if (runningContentBlockType === 'thinking') {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'thinking_delta',
                    thinking: chunk.message.content,
                  }
                }
              } else {
                if (runningContentBlockType !== 'text') {
                  if (runningContentBlockType !== undefined) {
                    yield {
                      type: 'content_block_stop',
                    }
                  }
                  runningContentBlockType = 'text';
                  yield {
                    type: 'content_block_start',
                    content_block: {
                      type: 'text',
                      text: '',
                    }
                  }
                  yield {
                    type: 'content_block_delta',
                    delta: {
                      type: 'text_delta',
                      text: chunk.message.content,
                    }
                  }
                } else {
                  yield {
                    type: 'content_block_delta',
                    delta: {
                      type: 'text_delta',
                      text: chunk.message.content,
                    }
                  }
                }

              }

            }



          }
        }
        done = true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      } finally {
        if (runningContentBlockType !== undefined) {
          yield {
            type: 'content_block_stop',
          }
        }
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

      const messages: Message[] = [];
      const newMessage: Message = {
        role: message.role,
        content: text,
        images: images
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
