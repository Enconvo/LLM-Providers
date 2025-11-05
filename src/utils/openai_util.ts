import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  FileUtil,
  ImageUtil,
  LLMProvider,
  AITool,
  RequestOptions,
  Runtime,
  Stream,
  ToolMessage,
  uuid,
  ChatMessageContentListItem,
  AttachmentUtils,
  ContextUtils,
} from "@enconvo/api";
import OpenAI from "openai";
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

  export const serverTools = [
    {
      name: 'web_search',
      title: 'OpenAI Web Search',
      icon: 'https://file.enconvo.com/extensions/internet_browsing/assets/icon.png',
      description: '',
    }
  ]

  export const convertMessageToOpenAIResponseMessage = async (
    llmOptions: LLMProvider.LLMOptions,
    message: BaseChatMessageLike,
    params: LLMProvider.Params,
  ): Promise<(ResponseOutputItem | ResponseInputItem)[]> => {
    let role = message.role;

    const isAgentMode = Runtime.isAgentMode();

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

      async function handleImageContentItem(url: string, description?: string) {
        const newMessageContents: (ResponseInputContent | ResponseOutputText)[] = [];
        if (
          role === "user" &&
          llmOptions.modelName.visionEnable === true
        ) {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            newMessageContents.push({
              type: "input_image",
              detail: "auto",
              image_url: url,
            });
          } else {
            url = await ImageUtil.compressImage(url);
            const base64 = await FileUtil.convertUrlToBase64(url);
            if (base64) {
              const mimeType = mime.getType(url) || "image/png";
              newMessageContents.push({
                type: "input_image",
                detail: "auto",
                image_url: `data:image/${mimeType};base64,${base64}`,
              });
            }
          }
        }
        if (description) {
          if (role === "user" || role === "system") {
            newMessageContents.push({
              type: "input_text",
              text: description,
            });
          } else if (role === "assistant") {
            newMessageContents.push({
              type: "output_text",
              text: description,
              annotations: [],
            });
          }
        } else {
          const imageGenerationToolEnabled = params.imageGenerationToolEnabled && params.imageGenerationToolEnabled !== 'disabled';
          const videoGenerationToolEnabled = params.videoGenerationToolEnabled && params.videoGenerationToolEnabled !== 'disabled';
          if ((isAgentMode || imageGenerationToolEnabled || videoGenerationToolEnabled) && params.addImageAdditionalInfo !== false) {
            if (role === "user" || role === "system") {
              newMessageContents.push({
                type: "input_text",
                text: `The above image's url is ${url} , only used for reference when you use tool.`,
              });
            } else if (role === "assistant") {
              newMessageContents.push({
                type: "output_text",
                text: `The above image's url is ${url} , only used for reference when you use tool.`,
                annotations: [],
              });
            }
          }
        }
        return newMessageContents;
      }


      for (const item of message.content) {
        if (item.type === "context") {
          const contextItems = item.items;
          for (const contextItem of contextItems) {
            if (contextItem.type === "screenshot") {
              const description = `[Context Item] This is a screenshot, url is ${contextItem.url}`;
              const newMessageContents = await handleImageContentItem(contextItem.url, description);
              messageContents.push(...newMessageContents);
            } else if (
              contextItem.type === "text" ||
              contextItem.type === "selectionText"
            ) {
              const textContent = `[Context Item] ${JSON.stringify(contextItem)}`;
              if (role === "user" || role === "system") {
                messageContents.push({
                  type: "input_text",
                  text: textContent,
                });
              } else if (role === "assistant") {
                messageContents.push({
                  type: "output_text",
                  text: textContent,
                  annotations: [],
                });
              }
            } else if (
              contextItem.type === "browserTab" ||
              contextItem.type === "window"
            ) {
              const textContent = `[Context Item] ${JSON.stringify(contextItem)}`;
              if (role === "user" || role === "system") {
                messageContents.push({
                  type: "input_text",
                  text: textContent,
                });
              } else if (role === "assistant") {
                messageContents.push({
                  type: "output_text",
                  text: textContent,
                  annotations: [],
                });
              }
            } else if (contextItem.type === "file") {
              const url = contextItem.url.replace("file://", "");
              if (FileUtil.isImageFile(url)) {
                const description = `[Context Item] This is a image file , url is ${url}`;
                const newMessageContents = await handleImageContentItem(url, description);
                messageContents.push(...newMessageContents);
              } else {
                const readableContent = isAgentMode
                  ? []
                  : await AttachmentUtils.getAttachmentsReadableContent({
                    files: [url],
                    loading: true,
                  });

                const textContent = (() => {
                  if (readableContent.length > 0) {
                    const text = readableContent[0].contents
                      .map((item) => item.text)
                      .join("\n");
                    const newItem = {
                      ...contextItem,
                      content: text,
                    };
                    return `[Context Item] ${JSON.stringify(newItem)}`;
                  }
                  return `[Context Item] ${JSON.stringify(contextItem)}`;
                })();

                if (role === "user" || role === "system") {
                  messageContents.push({
                    type: "input_text",
                    text: textContent,
                  });
                } else if (role === "assistant") {
                  messageContents.push({
                    type: "output_text",
                    text: textContent,
                    annotations: [],
                  });
                }
              }
            } else if (contextItem.type === "transcript") {
              const newContextItem = await ContextUtils.syncUnloadedContextItem(contextItem);
              const textContent = `[Context Item] ${JSON.stringify(newContextItem)}`;
              if (role === "user" || role === "system") {
                messageContents.push({
                  type: "input_text",
                  text: textContent,
                });
              } else if (role === "assistant") {
                messageContents.push({
                  type: "output_text",
                  text: textContent,
                  annotations: [],
                });
              }
            }
          }
        } else if (item.type === "image_url") {
          let url = item.image_url.url.replace("file://", "");
          const newMessageContents = await handleImageContentItem(url);
          messageContents.push(...newMessageContents);
        } else if (item.type === "flow_step") {
          const results = item.flowResults
            .map((message: any) => {
              return message.content;
            })
            .flat();

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
            toolCallMessage,
            toolCallOutputMessage,
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
          const url = item.file_url.url.replace("file://", "");
          let readableContent = isAgentMode ? [] : await AttachmentUtils.getAttachmentsReadableContent({
            files: [url],
            loading: true,
          })

          if (role === "user" || role === "system") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "input_text",
                text: `# audio file url: ${url}\n # audio file transcript: ${text}`,
              });
            } else {
              messageContents.push({
                type: "input_text",
                text: `This is a audio file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
              });
            }
          } else if (role === "assistant") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "output_text",
                text: `# audio file url: ${url}\n # audio file transcript: ${text}`,
                annotations: [],
              });
            } else {
              messageContents.push({
                type: "output_text",
                text: `This is a audio file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
                annotations: [],
              });
            }
          }
        } else if (item.type === "video") {
          const url = item.file_url.url.replace("file://", "");
          let readableContent = isAgentMode ? [] : await AttachmentUtils.getAttachmentsReadableContent({
            files: [url],
            loading: true,
          })

          if (role === "user" || role === "system") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "input_text",
                text: `# video file url: ${url}\n # video file transcript: ${text}`,
              });
            } else {
              messageContents.push({
                type: "input_text",
                text: `This is a video file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
              });
            }
          } else if (role === "assistant") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "output_text",
                text: `# video file url: ${url}\n # video file transcript: ${text}`,
                annotations: [],
              });
            } else {
              messageContents.push({
                type: "output_text",
                text: `This is a video file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
                annotations: [],
              });
            }
          }
        } else if (item.type === "file") {
          const url = item.file_url.url.replace("file://", "");
          if (FileUtil.isImageFile(url)) {
            const newMessageContents = await handleImageContentItem(url);
            messageContents.push(...newMessageContents);
            continue;
          }
          let readableContent = isAgentMode ? [] : await AttachmentUtils.getAttachmentsReadableContent({
            files: [url],
            loading: true,
          })

          if (role === "user" || role === "system") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "input_text",
                text: `# file url: ${url}\n # file content: ${text}`,
              });
            } else {
              messageContents.push({
                type: "input_text",
                text: `This is a file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
              });
            }
          } else if (role === "assistant") {
            if (readableContent.length > 0) {
              const text = readableContent[0].contents.map((item) => item.text).join("\n")
              messageContents.push({
                type: "output_text",
                text: `# file url: ${url}\n # file content: ${text}`,
                annotations: [],
              });
            } else {
              messageContents.push({
                type: "output_text",
                text: `This is a file , url is ${url}, this url is only used for reference when you use tool, if not , ignore this .`,
                annotations: [],
              });
            }
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
    llmOptions: LLMProvider.LLMOptions,
    message: BaseChatMessageLike,
    params: LLMProvider.Params,
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    let role = message.role;
    if (
      llmOptions.modelName &&
      llmOptions.modelName.systemMessageEnable === false &&
      message.role === "system"
    ) {
      message.role = "user";
      const assistantMessage: AssistantMessage = BaseChatMessage.assistant(
        "Got it, I will follow your instructions and respond using your language.",
      );
      //@ts-ignore
      return [message, assistantMessage];
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
      const isAgentMode = Runtime.isAgentMode();

      async function handleImageContentItem(url: string, description?: string) {
        const newMessageContents: OpenAI.Chat.ChatCompletionContentPart[] = [];
        if (
          role === "user" &&
          llmOptions.modelName.visionEnable === true
        ) {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            // Handle remote URLs directly
            newMessageContents.push({
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
              newMessageContents.push({
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              });
            }
          }
        }

        if (description) {
          newMessageContents.push({
            type: "text",
            text: description,
          });
          return newMessageContents;
        }

        const imageGenerationToolEnabled = params.imageGenerationToolEnabled && params.imageGenerationToolEnabled !== 'disabled';
        const videoGenerationToolEnabled = params.videoGenerationToolEnabled && params.videoGenerationToolEnabled !== 'disabled';
        if ((isAgentMode || imageGenerationToolEnabled || videoGenerationToolEnabled) && params.addImageAdditionalInfo !== false) {
          newMessageContents.push({
            type: "text",
            text: `The above image's url is ${url} , this url is only used for reference when you use tool, if not , ignore this .`,
          });
        }
        return newMessageContents;
      }

      for (const item of message.content) {
        let role = message.role as "user" | "assistant";
        if (item.type === "context") {
          const contextItems = item.items;
          for (const contextItem of contextItems) {
            if (contextItem.type === "screenshot") {
              const description = `[Context Item] This is a screenshot, url is ${contextItem.url}`;
              const newMessageContents = await handleImageContentItem(
                contextItem.url,
                description,
              );
              messageContents.push(...newMessageContents);
            } else if (
              contextItem.type === "text" ||
              contextItem.type === "selectionText"
            ) {
              messageContents.push({
                type: "text",
                text: `[Context Item] ${JSON.stringify(contextItem)}`,
              });
            } else if (
              contextItem.type === "browserTab" ||
              contextItem.type === "window"
            ) {
              messageContents.push({
                type: "text",
                text: `[Context Item] ${JSON.stringify(contextItem)}`,
              });
            } else if (contextItem.type === "file") {
              const url = contextItem.url.replace("file://", "");
              if (FileUtil.isImageFile(url)) {
                const description = `[Context Item] This is a image file , url is ${url}`;
                const newMessageContents = await handleImageContentItem(
                  url,
                  description,
                );
                messageContents.push(...newMessageContents);
              } else {
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
                  const newItem = {
                    ...contextItem,
                    content: text,
                  };
                  messageContents.push({
                    type: "text",
                    text: `[Context Item] ${JSON.stringify(newItem)}`,
                  });
                } else {
                  messageContents.push({
                    type: "text",
                    text: `[Context Item] ${JSON.stringify(contextItem)}`,
                  });
                }
              }
            }
          }
        } else if (item.type === "image_url") {
          let url = item.image_url.url.replace("file://", "");
          const newMessageContents = await handleImageContentItem(url);
          messageContents.push(...newMessageContents);
          // Check if the URL is valid and if vision is enabled for processing images
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

          if (llmOptions.modelName.toolUse === true) {
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
          if (role === "user" && llmOptions.modelName.audioEnable === true) {
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
            // fall through to textual handling below
          }
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
            messageContents.push({
              type: "text",
              text: `# audio file url: ${url}\n # audio file transcript: ${text}`,
            });
          } else {
            messageContents.push({
              type: "text",
              text:
                "This is a audio file , url is " +
                url +
                " , only used for reference when you use tool, if not , ignore this .",
            });
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
            messageContents.push({
              type: "text",
              text: `# video file url: ${url}\n # video file transcript: ${text}`,
            });
          } else {
            messageContents.push({
              type: "text",
              text:
                `This is a video file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            });
          }
        } else if (item.type === "file") {
          const url = item.file_url.url.replace("file://", "");
          if (FileUtil.isImageFile(url)) {
            const newMessageContents = await handleImageContentItem(url);
            messageContents.push(...newMessageContents);
            continue;
          }
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
            messageContents.push({
              type: "text",
              text: `# file url: ${url}\n # file content: ${text}`,
            });
          } else {
            messageContents.push({
              type: "text",
              text:
                `This is a file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
            });
          }
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

      const modelName = llmOptions.modelName.value.toLowerCase();
      const isDeepSeekR1 = modelName.includes("deepseek");

      if (llmOptions.modelName.sequenceContentDisable || isDeepSeekR1) {
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
        //@ts-ignore
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

    //@ts-ignore
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
    params: LLMProvider.Params,
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
          convertMessageToOpenAIMessage(options, message, params),
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

    // console.log("openai Completions newMessages", JSON.stringify(newMessages, null, 2))
    return newMessages;
  };

  export const convertMessagesToOpenAIResponseMessages = async (
    options: LLMProvider.LLMOptions,
    messages: BaseChatMessageLike[],
    params: LLMProvider.Params,
  ): Promise<ResponseInputItem[]> => {
    let newMessages = (
      await Promise.all(
        messages.map((message) =>
          convertMessageToOpenAIResponseMessage(options, message, params),
        )
      )
    ).flat();

    // console.log("openai Responses newMessages", JSON.stringify(newMessages, null, 2))
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
      let runningContentBlockType: BaseChatMessageChunk.ContentBlock['type'] | undefined;
      try {
        for await (const chunk of response) {
          // console.log("chunk", JSON.stringify(chunk, null, 2), options?.commandName)
          if (done) continue;
          if (chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            if (choice.delta.content) {
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
                    text: choice.delta.content,
                  }
                }
              } else {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'text_delta',
                    text: choice.delta.content,
                  }
                }
              }
            } else if (choice.delta.tool_calls && choice.delta.tool_calls.length > 0) {
              const toolCall = choice.delta.tool_calls[0];
              const toolFunction = toolCall.function;
              if (runningContentBlockType !== 'tool_use') {
                if (runningContentBlockType !== undefined) {
                  yield {
                    type: 'content_block_stop',
                  }
                }
                runningContentBlockType = 'tool_use';
                if (toolFunction?.name) {
                  let input = undefined;
                  if (toolFunction.arguments) {
                    try {
                      input = JSON.parse(toolFunction.arguments);
                    } catch (e) {
                      input = {}
                    }
                  }

                  yield {
                    type: 'content_block_start',
                    content_block: {
                      type: 'tool_use',
                      name: toolFunction.name,
                      input: input || {},
                      id: toolCall.id || '',
                    }
                  }
                }
              } else {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'input_json_delta',
                    partial_json: toolFunction?.arguments || '',
                  }
                }
              }
              //@ts-ignore
            } else if (choice.delta.reasoning_content && choice.delta.reasoning_content !== '') {
              if (runningContentBlockType !== 'thinking') {
                if (runningContentBlockType !== undefined) {
                  yield {
                    type: 'content_block_stop',
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
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'thinking_delta',
                    //@ts-ignore
                    thinking: choice.delta.reasoning_content,
                  }
                }
              } else {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'thinking_delta',
                    //@ts-ignore
                    thinking: choice.delta.reasoning_content,
                  }
                }
              }
            }
          }
        }
        done = true;
      } catch (e) {
        console.log(e);
        if (e instanceof Error && e.name === "AbortError") return;
        throw e;
      } finally {
        if (runningContentBlockType !== undefined) {
          yield {
            type: 'content_block_stop',
          }
        }
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

          if (chunk.type === "response.output_item.added") {
            if (chunk.item.type === "function_call") {
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'tool_use',
                  name: chunk.item.name,
                  input: {},
                  id: chunk.item.call_id,
                }
              }
            } else if (chunk.item.type === 'web_search_call') {
              const serverTool = OpenAIUtil.serverTools.find((tool) => tool.name === 'web_search');
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'server_tool_use',
                  name: 'web_search',
                  input: {},
                  id: chunk.item.id,
                  ...serverTool
                },
              }
            }
          } else if (chunk.type === "response.output_item.done") {
            if (chunk.item.type === 'function_call') {
              yield {
                type: 'content_block_stop',
              }
            } else if (chunk.item.type === 'web_search_call') {
              const serverTool = OpenAIUtil.serverTools.find((tool) => tool.name === 'web_search');

              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'server_tool_use_result',
                  message_contents: [],
                  tool: {
                    name: 'web_search',
                    ...serverTool,
                    //@ts-ignore
                    input: { query: chunk.item?.action?.query },
                    id: chunk.item.id,
                  }
                },
              }
            }
          } else if (chunk.type === "response.content_part.added") {
            if (chunk.part.type === 'output_text') {
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'text',
                  text: chunk.part.text,
                }
              }
            }
          } else if (chunk.type === "response.content_part.done") {
            yield {
              type: 'content_block_stop',
            }
          } else if (chunk.type === "response.output_text.delta") {
            yield {
              type: 'content_block_delta',
              delta: {
                type: 'text_delta',
                text: chunk.delta,
              }
            }
          } else if (chunk.type === "response.reasoning_summary_part.added") {
            if (chunk.part.type === 'summary_text') {
              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'thinking',
                  thinking: chunk.part.text,
                }
              }
            }
          } else if (chunk.type === "response.reasoning_summary_text.delta") {
            yield {
              type: 'content_block_delta',
              delta: {
                type: 'thinking_delta',
                thinking: chunk.delta,
              }
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
                      user: (new URL(block.url)).hostname,
                      icon: `https://www.google.com/s2/favicons?domain=${block.url}&sz=${128}`,
                    }
                  }
                  return undefined
                }).filter((item) => item !== undefined) || [];

                if (items.length > 0) {
                  const messageContent = ChatMessageContent.searchResultList({
                    items,
                  });

                  yield {
                    type: 'content_block_start',
                    content_block: {
                      type: 'message_content',
                      content: [messageContent],
                    }
                  }
                }
              }
            }
          } else if (chunk.type === "response.function_call_arguments.delta") {
            yield {
              type: 'content_block_delta',
              delta: {
                type: 'input_json_delta',
                partial_json: chunk.delta,
              }
            }
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
