import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  environment,
  Extension,
  FileUtil,
  ImageUtil,
  LLMProvider,
  AITool,
  NativeAPI,
  RequestOptions,
  Runtime,
  Stream,
  ToolMessage,
  uuid,
  ChatMessageContentListItem,
} from "@enconvo/api";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import {
  EasyInputMessage,
  ResponseFunctionToolCall,
  ResponseInputContent,
  ResponseInputItem,
  ResponseInputMessageContentList,
  ResponseOutputItem,
  ResponseOutputRefusal,
  ResponseOutputText,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";
import mime from "mime";
export namespace OpenAIUtil {
  function isSupportedImageType(url: string) {
    const supportedTypes = ["jpeg", "jpg", "png", "webp"];
    const mimeType = path.extname(url).toLowerCase().slice(1);
    return supportedTypes.includes(mimeType);
  }

  export const convertMessageToOpenAIResponseMessage = async (
    options: LLMProvider.LLMOptions,
    message: BaseChatMessageLike,
  ): Promise<(ResponseOutputItem | ResponseInputItem)[]> => {
    let role = message.role;

    if (message.role === "tool") {
      const rawToolMessage: ToolMessage = message as ToolMessage;

      const toolCallMessage: ResponseInputItem = {
        type: "function_call_output",
        call_id: rawToolMessage.tool_call_id,
        output:
          typeof rawToolMessage.content === "string"
            ? rawToolMessage.content
            : JSON.stringify(rawToolMessage.content),
      };

      return [toolCallMessage];
    }

    if (message.role === "assistant") {
      const aiMessage = message as AssistantMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        const firstToolCall = aiMessage.tool_calls[0];
        const toolCallMessage: ResponseOutputItem = {
          type: "function_call",
          call_id: firstToolCall.id,
          name: firstToolCall.function.name,
          arguments: firstToolCall.function.arguments,
        };
        return [toolCallMessage];
      }
    }

    if (
      typeof message.content === "string" &&
      (role === "user" || role === "assistant" || role === "system")
    ) {
      let newMessage: ResponseInputItem;
      if (role === "system" || role === "user") {
        newMessage = {
          type: "message",
          content: message.content,
          role: "user",
        };
      } else {
        const id = message.id || `msg_${uuid()}`;
        newMessage = {
          id: id.startsWith("msg_") ? id : `msg_${id}`,
          type: "message",
          content: message.content,
          role: "assistant",
        };
      }
      return [newMessage];
    } else if (
      Array.isArray(message.content) &&
      (role === "user" || role === "assistant" || role === "system")
    ) {
      let newMessages: ResponseInputItem[] = [];
      let messageContents: (
        | ResponseInputContent
        | ResponseOutputText
        | ResponseOutputRefusal
      )[] = [];

      const handleMessageContent = () => {
        if (messageContents.length > 0) {
          if (role === "user" || role === "system") {
            newMessages.push({
              type: "message",
              content: messageContents as ResponseInputMessageContentList,
              role:
                role === "system" ? "user" : (role as EasyInputMessage["role"]),
            });
          } else if (role === "assistant") {
            const id = message.id || `msg_${uuid()}`;
            newMessages.push({
              type: "message",
              content: messageContents as Array<
                ResponseOutputText | ResponseOutputRefusal
              >,
              role: "assistant",
              status: "completed",
              id: id.startsWith("msg_") ? id : `msg_${id}`,
            });
          }
          messageContents = [];
        }
      };

      for (const item of message.content) {
        if (item.type === "image_url") {
          let url = item.image_url.url.replace("file://", "");
          if (
            role === "user" &&
            options.modelName.visionEnable === true &&
            isSupportedImageType(url)
          ) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
              messageContents.push({
                type: "input_image",
                detail: "auto",
                image_url: url,
              });
            } else {
              url = await ImageUtil.compressImage(url);
              const base64 = await FileUtil.convertUrlToBase64(url);
              if (base64) {
                const mimeType = mime.getType(url) || "image/png";
                messageContents.push({
                  type: "input_image",
                  detail: "auto",
                  image_url: `data:image/${mimeType};base64,${base64}`,
                });
              }
            }
          }

          if (Runtime.isAgentMode() && role === "user") {
            messageContents.push({
              type: "input_text",
              text: `This is a image file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            });
          }
        } else if (item.type === "flow_step") {
          const results = item.flowResults
            .map((message: any) => {
              return message.content;
            })
            .flat();

          console.log("flow_step", JSON.stringify(results, null, 2));

          const toolCallOutputMessage: ResponseInputItem = {
            type: "function_call_output",
            call_id: item.flowId,
            output: JSON.stringify(results),
          };

          const toolCallMessage: ResponseFunctionToolCall = {
            type: "function_call",
            call_id: item.flowId,
            name: item.flowName.replace("|", "--"),
            arguments: item.flowParams || "",
          };

          const msgs: ResponseInputItem[] = [
            toolCallOutputMessage,
            toolCallMessage,
          ];

          handleMessageContent();
          newMessages.push(...msgs);
        } else if (item.type === "text" && item.text.trim() !== "") {
          if (role === "user" || role === "system") {
            messageContents.push({
              type: "input_text",
              text: item.text,
            });
          } else if (role === "assistant") {
            messageContents.push({
              type: "output_text",
              text: item.text,
              annotations: [],
            });
          }
        } else if (item.type === "audio") {
          // function isSupportAudioType(mimeType: string): boolean {
          //     return mimeType === "mp3" || mimeType === "wav"
          // }
          // const url = item.file_url.url
          // const mimeType = path.extname(url).slice(1)
          // const isSupport = isSupportAudioType(mimeType)
          // if (role === "user" && url.startsWith("file://") && options.modelName.audioEnable === true && isSupport) {
          //     const base64 = FileUtil.convertFileUrlToBase64(url)
          //     messageContents.push({
          //         type: "input_audio",
          //         input_audio: {
          //             data: base64,
          //             format: mimeType as "mp3" | "wav"
          //         }
          //     })
          // } else {
          //     messageContents.push({
          //         type: "text",
          //         text: "This is a audio file , url is " + url || ""
          //     })
          // }
          const url = item.file_url.url.replace("file://", "");
          if (role === "user" || role === "system") {
            messageContents.push({
              type: "input_text",
              text: `This is a audio file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
            });
          } else if (role === "assistant") {
            messageContents.push({
              type: "output_text",
              text: `This is a audio file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
              annotations: [],
            });
          }
        } else if (item.type === "video") {
          const url = item.file_url.url.replace("file://", "");
          if (role === "user" || role === "system") {
            messageContents.push({
              type: "input_text",
              text: `This is a video file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
            });
          } else if (role === "assistant") {
            messageContents.push({
              type: "output_text",
              text: `This is a video file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
              annotations: [],
            });
          }
        } else if (item.type === "file") {
          const url = item.file_url.url.replace("file://", "");
          if (role === "user" || role === "system") {
            messageContents.push({
              type: "input_text",
              text: `This is a file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
            });
          } else if (role === "assistant") {
            messageContents.push({
              type: "output_text",
              text: `This is a file , url is ${url},only used for reference when you use tool, if not , ignore this .`,
              annotations: [],
            });
          }
        } else if (item.type === "thinking") {
        } else {
          if (role === "user" || role === "system") {
            messageContents.push({
              type: "input_text",
              text: JSON.stringify(item),
            });
          } else if (role === "assistant") {
            messageContents.push({
              type: "output_text",
              text: JSON.stringify(item),
              annotations: [],
            });
          }
        }
      }

      handleMessageContent();

      return newMessages;
    }
    return [];
  };

  export const convertMessageToOpenAIMessage = async (
    options: LLMProvider.LLMOptions,
    message: BaseChatMessageLike,
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    let role = message.role;
    if (
      options.modelName &&
      options.modelName.systemMessageEnable === false &&
      message.role === "system"
    ) {
      message.role = "user";
      const assistantMessage: AssistantMessage = BaseChatMessage.assistant(
        "Got it, I will follow your instructions and respond using your language.",
      );

      //@ts-ignore
      return [message, assistantMessage];
    }

    if (message.role === "tool") {
      const toolMessage = message as ToolMessage;
      let content: ChatMessageContent[] = [];
      try {
        content = JSON.parse(message.content as string);
        toolMessage.content = content.filter((item) => {
          if (item.type === "image_url") {
            return false;
          }
          return true;
        });
      } catch (e) {
        console.log("toolMessage content error", message.content);
      }
      // const toolAdditionalMessages = convertToolResults(content, options)
      toolMessage.content = JSON.stringify(content);
      console.log("toolMessage", JSON.stringify(toolMessage, null, 2));

      //@ts-ignore
      return [message];
    }

    if (message.role === "assistant") {
      const aiMessage = message as AssistantMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        //@ts-ignore
        return [aiMessage];
      }
    }

    if (typeof message.content === "string") {
      return [
        //@ts-ignore
        {
          role: role,
          content: message.content,
        },
      ];
    } else {
      let newMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      let messageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];

      for (const item of message.content) {
        let role = message.role as "user" | "assistant";
        if (item.type === "image_url") {
          let url = item.image_url.url.replace("file://", "");

          // Check if the URL is valid and if vision is enabled for processing images
          if (
            role === "user" &&
            options.modelName.visionEnable === true &&
            isSupportedImageType(url)
          ) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
              // Handle remote URLs directly
              messageContents.push({
                type: "image_url",
                image_url: {
                  url: url,
                },
              });
            } else {
              url = await ImageUtil.compressImage(url);

              const base64 = await FileUtil.convertUrlToBase64(url);
              if (base64) {
                const mimeType = mime.getType(url) || "image/png";
                messageContents.push({
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                });
              }
            }
          }

          if (Runtime.isAgentMode()) {
            messageContents.push({
              type: "text",
              text: `This is a image file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            });
          }
        } else if (item.type === "flow_step") {
          const results = item.flowResults
            .map((message: any) => {
              return message.content;
            })
            .flat();

          const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
              role: "assistant",
              tool_calls: [
                {
                  type: "function",
                  id: item.flowId,
                  function: {
                    name: item.flowName.replace("|", "-"),
                    arguments: item.flowParams || "",
                  },
                },
              ],
            },
            {
              role: "tool",
              tool_call_id: item.flowId,
              content: JSON.stringify(results),
            },
          ];

          if (options.modelName.toolUse === true) {
            newMessages.push(...msgs);
          } else {
            messageContents.push({
              type: "text",
              text:
                "This is a tool call , name is " +
                item.flowName +
                " , args is " +
                JSON.stringify(item.flowParams) +
                " , results is " +
                JSON.stringify(results),
            });
          }
        } else if (item.type === "text") {
          if (item.text.trim() !== "") {
            messageContents.push({
              type: "text",
              text: item.text,
            });
          }
        } else if (item.type === "audio") {
          const url = item.file_url.url.replace("file://", "");
          const mimeType = mime.getType(url) || "mp3";
          if (role === "user" && options.modelName.audioEnable === true) {
            const base64 = FileUtil.convertFileUrlToBase64(url);
            if (base64) {
              messageContents.push({
                type: "input_audio",
                input_audio: {
                  data: base64,
                  format: mimeType as "mp3" | "wav",
                },
              });
            }
          } else {
            messageContents.push({
              type: "text",
              text:
                "This is a audio file , url is " +
                url +
                " , only used for reference when you use tool, if not , ignore this . " ||
                "",
            });
          }
        } else if (item.type === "video") {
          const url = item.file_url.url.replace("file://", "");
          messageContents.push({
            type: "text",
            text:
              `This is a video file , url is ${url} , only used for reference when you use tool, if not , ignore this .` ||
              "",
          });
        } else if (item.type === "file") {
          const url = item.file_url.url.replace("file://", "");
          messageContents.push({
            type: "text",
            text:
              `This is a file , url is ${url} , only used for reference when you use tool, if not , ignore this .` ||
              "",
          });
        } else if (item.type === "thinking") {
          // do nothing
        } else {
          messageContents.push({
            type: "text",
            text: JSON.stringify(item),
          });
        }
      }

      if (messageContents.length > 0) {
        //@ts-ignore
        newMessages.push({
          role: role,
          content: messageContents,
        });
      }

      const modelName = options.modelName.value.toLowerCase();
      const isDeepSeekR1 = modelName.includes("deepseek");

      if (options.modelName.sequenceContentDisable || isDeepSeekR1) {
        newMessages = newMessages.map((message) => {
          if (typeof message.content === "string") {
            return message;
          } else {
            message.content = message.content
              ?.map((item) => {
                if (item.type === "text") {
                  return item.text;
                }
                return JSON.stringify(item);
              })
              .join("\n");
          }
          return message;
        });
      }
      return newMessages;
    }
  };


  export const convertToolsToOpenAIResponseTools = (
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
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      };
      return newTool;
    });

    // console.log("newTools", JSON.stringify(newTools, null, 2))

    return newTools;
  };

  export const convertToolsToOpenAITools = (
    tools?: AITool[],
  ): OpenAI.Chat.ChatCompletionTool[] | undefined => {
    if (!tools) {
      return undefined;
    }

    let newTools: OpenAI.Chat.ChatCompletionTool[] | undefined = tools?.map(
      (tool) => {
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

        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: tool.strict,
          },
        };
      },
    );

    // console.log("newTools", JSON.stringify(newTools, null, 2))

    return newTools;
  };

  export const convertMessagesToOpenAIMessages = async (
    options: LLMProvider.LLMOptions,
    messages: BaseChatMessageLike[],
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    if (
      options.modelName &&
      options.modelName.visionImageCountLimit !== undefined &&
      options.modelName.visionImageCountLimit > 0 &&
      options.modelName.visionEnable === true
    ) {
      if (
        options.modelName.visionImageCountLimit !== undefined &&
        options.modelName.visionEnable === true
      ) {
        const countLimit = options.modelName.visionImageCountLimit;
        let imageCount = 0;

        //@ts-ignore
        messages = messages
          .reverse()
          .map((message) => {
            if (typeof message.content !== "string") {
              const filteredContent = message.content
                .filter((item: any) => {
                  if (item.type === "image_url" && imageCount < countLimit) {
                    imageCount++;
                    return true;
                  }
                  return item.type !== "image_url";
                })
                .reverse();

              return { ...message, content: filteredContent };
            }
            return message;
          })
          .reverse();

        imageCount = 0;
        messages = messages.filter((message: any) => {
          if (
            typeof message.content !== "string" &&
            message.content.some((item: any) => item.type === "image_url")
          ) {
            if (imageCount < countLimit) {
              imageCount++;
              return true;
            }
            return false;
          }
          return true;
        });
      }
    }

    let newMessages = (
      await Promise.all(
        messages.map((message) =>
          convertMessageToOpenAIMessage(options, message),
        ),
      )
    )
      .flat()
      .filter((message) => {
        if (typeof message.content === "string" && message.content === "") {
          return false;
        } else {
          return message.content?.length !== 0;
        }
      })
      .map((message) => {
        // If content is an array with single text item, convert it to string
        if (
          message.content &&
          Array.isArray(message.content) &&
          message.content.length === 1 &&
          message.content[0].type === "text"
        ) {
          message.content = message.content[0].text;
        }

        return message;
      });

    const allSystemMessages = newMessages.filter(
      (message) => message.role === "system",
    );
    const allUserMessages = newMessages.filter(
      (message) => message.role !== "system",
    );

    const systemMessage =
      allSystemMessages.length > 1
        ? {
          role: "system",
          content: allSystemMessages
            .map((message) => {
              if (typeof message.content === "string") {
                return message.content;
              } else {
                return message.content
                  .map((item) => {
                    if (item.type === "text") {
                      return item.text;
                    }
                  })
                  .join("\n\n");
              }
            })
            .join("\n\n"),
        }
        : allSystemMessages.length > 0
          ? allSystemMessages[0]
          : undefined;

    //@ts-ignore
    newMessages = [
      ...(systemMessage ? [systemMessage] : []),
      ...allUserMessages,
    ];
    // ensure first message is user
    function ensureFirstMessageIsUser(
      messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ) {
      // ensure first message is user
      let checked = false;
      const firstMessageRole = messages[0]?.role;
      const secondMessageRole = messages[1]?.role;

      if (firstMessageRole === "assistant" || firstMessageRole === "tool") {
        messages.shift();
        checked = true;
      } else if (
        firstMessageRole === "system" &&
        (secondMessageRole === "assistant" || secondMessageRole === "tool")
      ) {
        // remove the second message
        messages.splice(1, 1);
        checked = true;
      }

      if (checked) {
        return ensureFirstMessageIsUser(messages);
      }
      return messages;
    }

    newMessages = ensureFirstMessageIsUser(newMessages);

    // console.log("newMessages", JSON.stringify(newMessages, null, 2))
    return newMessages;
  };

  export const convertMessagesToOpenAIResponseMessages = async (
    options: LLMProvider.LLMOptions,
    messages: BaseChatMessageLike[],
  ): Promise<ResponseInputItem[]> => {
    let newMessages = (
      await Promise.all(
        messages.map((message) =>
          convertMessageToOpenAIResponseMessage(options, message),
        ),
      )
    ).flat();

    console.log("openai newMessages", JSON.stringify(newMessages, null, 2))
    return newMessages;
  };

  export function streamFromOpenAI(
    response: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
    controller: AbortController,
    options?: RequestOptions,
  ): Stream<BaseChatMessageChunk> {
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
      try {
        let lastChunk: any = undefined;
        for await (const chunk of response) {
          if (options?.commandName === "chat_qwen" && lastChunk === undefined) {
            lastChunk = chunk;
            continue;
          }
          // console.log("chunk", JSON.stringify(chunk, null, 2), options?.commandName)
          if (done) continue;
          yield chunk;
        }
        done = true;
      } catch (e) {
        console.log(e);
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      } finally {
        if (!done) controller.abort();
      }
    }

    const stream = new Stream(iterator, controller);

    return stream;
  }

  export function streamFromOpenAIResponse(
    response: Stream<ResponseStreamEvent>,
    controller: AbortController,
  ): Stream<BaseChatMessageChunk> {
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
      try {
        for await (const chunk of response) {
          // console.log("chunk", JSON.stringify(chunk, null, 2))
          if (
            chunk.type !== "response.created" &&
            chunk.type !== "response.completed" &&
            chunk.type !== "response.in_progress"
          ) {
            // console.log("chunk", JSON.stringify(chunk, null, 2))
          }
          if (done) continue;

          if (chunk.type === "response.output_text.delta") {
            yield {
              model: "OpenAIResponse",
              id: chunk.item_id || `msg_${uuid()}`,
              choices: [
                {
                  delta: {
                    content: chunk.delta,
                    role: "assistant",
                  },
                  finish_reason: null,
                  index: 0,
                },
              ],
              created: Date.now(),
              object: "chat.completion.chunk",
            };
          } else if (chunk.type === "response.reasoning_summary_text.delta") {
            yield {
              model: "OpenAIResponse",
              id: chunk.item_id || `msg_${uuid()}`,
              choices: [
                {
                  delta: {
                    reasoning_content: chunk.delta,
                    role: "assistant",
                  },
                  finish_reason: null,
                  index: 0,
                },
              ],
              created: Date.now(),
              object: "chat.completion.chunk",
            };
          } else if (chunk.type === "response.web_search_call.in_progress") {
            yield {
              model: "OpenAIResponse",
              id: uuid(),
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        type: "server_tool",
                        index: 0,
                        id: chunk.item_id,
                        status: 'running',
                        tool: {
                          name: 'web_search',
                          title: 'OpenAI Web Search',
                          icon: 'https://file.enconvo.com/extensions/internet_browsing/assets/icon.png',
                          description: '',
                          toolType: 'method',
                        },
                      },
                    ],
                    role: "assistant",
                  },
                  finish_reason: null,
                  index: 0,
                },
              ],
              created: Date.now(),
              object: "chat.completion.chunk",
            };

          } else if (chunk.type === "response.output_item.done") {
            if (chunk.item.type === 'web_search_call') {

              yield {
                model: "OpenAIResponse",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          type: "server_tool",
                          index: 0,
                          id: chunk.item.id,
                          status: 'success',
                          tool_result: [],
                          //@ts-ignore
                          tool_arguments: chunk.item.status === 'completed' ? JSON.stringify({ query: chunk.item?.action?.query }) : undefined,
                          tool: {
                            name: 'web_search',
                            title: 'OpenAI Web Search',
                            icon: 'https://file.enconvo.com/extensions/internet_browsing/assets/icon.png',
                            description: '',
                            toolType: 'method',
                          },
                        },
                      ],
                      role: "assistant",
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
                created: Date.now(),
                object: "chat.completion.chunk",
              };
            }
          } else if (chunk.type === "response.completed") {
            const item = chunk.response.output.find((item) => item.type === 'message' && item.content.some((item) => item.type === 'output_text' && item.annotations));
            if (item && item.type === 'message') {
              const withAnnotationsContentItem = item.content.find((item) => item.type === 'output_text' && item.annotations);
              if (withAnnotationsContentItem?.type === 'output_text' && withAnnotationsContentItem.annotations) {
                const items: ChatMessageContentListItem[] = withAnnotationsContentItem.annotations.map((block) => {
                  if (block.type === 'url_citation') {
                    return {
                      url: block.url,
                      title: block.title,
                      icon: `https://www.google.com/s2/favicons?domain=${block.url}&sz=${128}`,
                    }
                  }
                  return undefined
                }).filter((item) => item !== undefined) || [];

                const messageContent = ChatMessageContent.searchResultList({
                  items,
                });

                yield {
                  model: "OpenAIResponse",
                  id: uuid(),
                  choices: [
                    {
                      delta: {
                        message_content: messageContent,
                        role: "assistant",
                      },
                      finish_reason: null,
                      index: 0,
                    },
                  ],
                  created: Date.now(),
                  object: "chat.completion.chunk",
                }

              }

            }
          } else if (chunk.type === "response.output_item.added") {
            if (chunk.item.type === "function_call") {
              yield {
                model: "OpenAIResponse",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          type: "function",
                          index: 0,
                          function: {
                            name: chunk.item.name,
                          },
                        },
                      ],
                      role: "assistant",
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
                created: Date.now(),
                object: "chat.completion.chunk",
              };
            }
          } else if (chunk.type === "response.function_call_arguments.delta") {
            yield {
              model: "OpenAIResponse",
              id: uuid(),
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        function: {
                          arguments: chunk.delta,
                        },
                      },
                    ],
                    role: "assistant",
                  },
                  finish_reason: null,
                  index: 0,
                },
              ],
              created: Date.now(),
              object: "chat.completion.chunk",
            };
          }
        }
        done = true;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      } finally {
        if (!done) controller.abort();
      }
    }
    return new Stream(iterator, controller);
  }
}
