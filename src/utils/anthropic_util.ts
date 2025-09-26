import Anthropic from "@anthropic-ai/sdk";
import {
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  FileUtil,
  ImageUtil,
  LLMProvider,
  AITool,
  Runtime,
  Stream,
  ChatMessageContentListItem,
  AttachmentUtils,
} from "@enconvo/api";
import path from "path";
import mime from "mime";



export namespace AnthropicUtil {

  export const serverTools = [
    {
      name: 'web_search',
      title: 'Claude Web Search',
      icon: 'https://file.enconvo.com/extensions/internet_browsing/assets/icon.png',
      description: '',
    }
  ]


  export const convertToolsToAnthropicTools = (
    tools?: AITool[],
  ): Anthropic.Tool[] | undefined => {
    if (!tools) {
      return undefined;
    }

    //@ts-ignore
    let newTools: Anthropic.Tool[] | undefined = tools?.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
        strict: tool.strict,
      };
    });

    return newTools;
  };

  export const getNumTokens = async (text: string): Promise<number> => {
    const tokens = text.length / 4;
    return tokens;
  };

  export const getNumTokensFromMessages = async (
    messages: Anthropic.Messages.MessageParam[],
  ): Promise<{
    totalCount: number;
    countPerMessage: number[];
  }> => {
    let totalCount = 0;

    const tokensPerMessage = 7;

    let allContent = "";

    messages.map(async (message) => {
      // 如果是message.content 是 string
      if (typeof message.content === "string") {
        allContent += message.content + message.role;
        totalCount += tokensPerMessage;
      } else {
        message.content.map((content) => {
          if (content.type === "text") {
            allContent += content.text;
          } else if (content.type === "tool_use") {
            allContent += content.name;
            allContent += JSON.stringify(content.input);
          } else if (content.type === "tool_result") {
            allContent += content.tool_use_id;
            if (typeof content.content === "string") {
              allContent += content.content;
            } else {
              content.content?.map((item) => {
                if (item.type === "text") {
                  allContent += item.text;
                } else if (item.type === "image") {
                  totalCount += 1500;
                }
              });
            }
          } else if (content.type === "image") {
            totalCount += 1500;
          }
        });
        totalCount += tokensPerMessage;
      }
      return message;
    });

    const contentTokens = await getNumTokens(allContent);

    totalCount += contentTokens;

    return { totalCount, countPerMessage: [] };
  };
}

type MessageContentType =
  | Anthropic.TextBlockParam
  | Anthropic.ImageBlockParam
  | Anthropic.ToolUseBlockParam
  | Anthropic.ToolResultBlockParam
  | Anthropic.ThinkingBlockParam;

const convertToolResults = async (results: (string | ChatMessageContent)[]) => {
  return (
    await Promise.all(
      results.map(async (result) => {
        if (typeof result === "string") {
          const text: Anthropic.TextBlockParam = {
            type: "text",
            text: result,
          };
          return [text];
        } else if (result.type === "text") {
          const text: Anthropic.TextBlockParam = {
            type: "text",
            text: result.text,
          };
          return [text];
        } else if (result.type === "image_url") {
          let url = result.image_url.url.replace("file://", "");
          let parts: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] =
            [];
          if (isSupportedImageType(url)) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
              parts.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: url,
                },
              });
            } else {
              // Handle local file URLs
              url = await ImageUtil.compressImage(url);
              const base64 = FileUtil.convertFileUrlToBase64(url);
              if (base64) {
                const mimeType = mime.getType(url) as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp";

                parts.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: `${mimeType}`,
                    data: base64,
                  },
                });
              }
            }
          }
          parts.push({
            type: "text",
            text: `The above image's url is ${url} , only used for reference when you use tool.`,
          });
          return parts;
        } else {
          const text: Anthropic.TextBlockParam = {
            type: "text",
            text: JSON.stringify(result),
          };
          return [text];
        }
      }),
    )
  ).flat();
};

function isSupportedImageType(url: string) {
  const supportedTypes = ["jpeg", "png", "jpg", "webp"];
  const mimeType = path.extname(url).toLowerCase().slice(1);
  return supportedTypes.includes(mimeType);
}

export const convertMessageToAnthropicMessage = async (
  message: BaseChatMessageLike,
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<Anthropic.Messages.MessageParam[]> => {
  let role = message.role as "user" | "assistant";

  if (typeof message.content === "string") {
    return [
      {
        role: role,
        content: message.content,
      },
    ];
  } else {
    const contents: Anthropic.MessageParam[] = [];
    let parts: MessageContentType[] = [];
    const isAgentMode = Runtime.isAgentMode();


    async function handleImageContentItem(url: string) {
      const newParts: MessageContentType[] = [];
      if (
        role === "user" &&
        options.modelName.visionEnable === true
      ) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          const mimeType =
            (mime.getType(url) as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp") || "image/png";
          newParts.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: url,
            },
          });
        } else {
          url = await ImageUtil.compressImage(url);

          const base64 = FileUtil.convertFileUrlToBase64(url);
          if (base64) {
            const mimeType =
              (mime.getType(url) as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp") || "image/png";
            newParts.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64,
              },
            });
          }
        }
      }

      const imageGenerationToolEnabled = params.imageGenerationToolEnabled && params.imageGenerationToolEnabled !== 'disabled';
      if ((Runtime.isAgentMode() || imageGenerationToolEnabled) && params.addImageAdditionalInfo !== false) {
        newParts.push({
          type: "text",
          text: `The above image's url is ${url} , only used for reference when you use tool.`,
        });
      }
      return newParts;
    }



    for (const item of message.content) {

      if (item.type === "image_url") {
        let url = item.image_url.url.replace("file://", "");
        const newParts = await handleImageContentItem(url);
        parts.push(...newParts);
        console.log("image item", JSON.stringify(parts, null, 2));
      } else if (item.type === "flow_step") {
        const results = item.flowResults
          .map((message) => {
            return message.content;
          })
          .flat();

        const toolResultMessages = await convertToolResults(results);

        let args = {};
        let toolUseContentLength = item.flowParams?.length || 0;
        try {
          args = JSON.parse(item.flowParams || "{}");
        } catch (e) {
          console.log("flowParams error", item.flowParams);
        }

        const toolUseMessage: Anthropic.ToolUseBlockParam = {
          type: "tool_use",
          name: item.flowName.replace("|", "-"),
          id: item.flowId,
          input: args,
        };

        if (toolUseContentLength > 1000) {
          toolUseMessage.cache_control = {
            type: "ephemeral",
          };
        }

        const toolResultMessage: Anthropic.ToolResultBlockParam = {
          type: "tool_result",
          tool_use_id: item.flowId,
          content: toolResultMessages,
        };

        if (JSON.stringify(toolResultMessages).length > 1000) {
          toolResultMessage.cache_control = {
            type: "ephemeral",
          };
        }

        const toolUseMessages: Anthropic.MessageParam[] = [
          {
            role: "assistant",
            content: [...parts, toolUseMessage],
          },
          {
            role: "user",
            content: [toolResultMessage],
          },
        ];
        parts = [];
        console.log("flow step parsed");

        contents.push(...toolUseMessages);
      } else if (item.type === "text" && item.text.trim() !== "") {
        parts.push({
          type: "text",
          text: item.text,
        });
      } else if (item.type === "thinking" && options.claude_thinking?.value && options.claude_thinking?.value !== 'disabled') {
        parts.push({
          type: "thinking",
          thinking: item.thinkingContent,
          signature: item.signature || "",
        });
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
          parts.push({
            type: "text",
            text: `# audio file url: ${url}\n # audio file transcript: ${text}`,
          });
        } else {
          parts.push({
            type: "text",
            text: `This is a audio file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
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
          parts.push({
            type: "text",
            text: `# video file url: ${url}\n # video file transcript: ${text}`,
          });
        } else {
          parts.push({
            type: "text",
            text: `This is a video file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
          });
        }
      } else if (item.type === "file") {
        const url = item.file_url.url.replace("file://", "");
        console.log("file url", url);
        if (FileUtil.isImageFile(url)) {
          const newParts = await handleImageContentItem(url);
          parts.push(...newParts);
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
          parts.push({
            type: "text",
            text: `# file url: ${url}\n # file content: ${text}`,
          });
        } else {
          parts.push({
            type: "text",
            text: `This is a file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
          });
        }
      } else {
        parts.push({
          type: "text",
          text: JSON.stringify(item),
        });
      }
    }

    if (parts.length > 0) {
      contents.push({
        role: role,
        content: parts,
      });
      parts = [];
    }

    return contents;
  }
};


export const convertMessagesToAnthropicMessages = async (
  messages: BaseChatMessageLike[],
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<Anthropic.Messages.MessageParam[]> => {
  console.log("Converting messages to Anthropic format...", JSON.stringify(messages, null, 2));

  let newMessages = (
    await Promise.all(
      messages.map((message) =>
        convertMessageToAnthropicMessage(message, options, params),
      ),
    )
  ).flat();

  newMessages = newMessages
    .filter((message) => {
      if (
        typeof message.content === "string" &&
        message.content.trim() === ""
      ) {
        console.log("message.content is empty", message);
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

  // count of tool_use
  const toolUseCount = newMessages.filter((message) => {
    if (message.content && Array.isArray(message.content)) {
      return message.content.some((content) => {
        const isToolUse = content.type === "tool_use";
        const isToolResult = content.type === "tool_result";
        if (isToolUse || isToolResult) {
          if (content.cache_control !== undefined) {
            return true;
          }
        }
        return false;
      });
    }
    return false;
  }).length;
  // 如果超过4个，则删除前面的的tool_use的content中的cache_control，保留4个
  if (toolUseCount > 2) {
    let toBeDeleted = toolUseCount - 2;
    let index = 0;
    newMessages = newMessages.map((message) => {
      if (message.content && Array.isArray(message.content)) {
        message.content = message.content.map((content) => {
          if (
            (content.type === "tool_result" || content.type === "tool_use") &&
            content.cache_control !== undefined
          ) {
            if (index < toBeDeleted) {
              index++;
              content.cache_control = undefined;
            }
          }
          return content;
        });
      }
      return message;
    });
  }

  newMessages = newMessages.slice(-20);

  if (
    newMessages[0].role === "user" &&
    newMessages[0].content &&
    Array.isArray(newMessages[0].content) &&
    newMessages[0].content.length > 0 &&
    newMessages[0].content[0].type === "tool_result"
  ) {
    newMessages = newMessages.slice(1);
  }

  console.log("anthropic newMessages", JSON.stringify(newMessages, null, 2));

  return newMessages;
};

export function streamFromAnthropic(
  response: AsyncIterable<Anthropic.Messages.MessageStreamEvent>,
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
    try {
      for await (const chunk of response) {
        // console.log("chunk", JSON.stringify(chunk, null, 2))
        if (chunk.type === "message_start") {
          yield {
            type: 'message_start',
            message: {
              role: chunk.message.role,
              content: [],
              model: chunk.message.model,
            }
          }
        }

        if (chunk.type === "content_block_start") {
          if (chunk.content_block.type === "text") {
            yield {
              type: 'content_block_start',
              content_block: chunk.content_block,
            }

          } else if (chunk.content_block.type === "thinking") {
            yield {
              type: 'content_block_start',
              content_block: chunk.content_block,
            }
          } else if (chunk.content_block.type === "tool_use") {
            yield {
              type: 'content_block_start',
              content_block: chunk.content_block,
            }
          } else if (chunk.content_block.type === "server_tool_use") {
            const chunkContentBlock = chunk.content_block as Anthropic.ServerToolUseBlock;
            const serverTool = AnthropicUtil.serverTools.find((tool) => tool.name === chunkContentBlock.name);
            yield {
              type: 'content_block_start',
              content_block: {
                type: 'server_tool_use',
                name: chunk.content_block.name,
                input: chunk.content_block.input,
                id: chunk.content_block.id,
                ...serverTool
              },
            }

          } else if (chunk.content_block.type === "web_search_tool_result") {
            // console.log("web_search_tool_result", JSON.stringify(chunk.content_block, null, 2))
            const groundingMetadata = chunk.content_block.content;
            if (Array.isArray(groundingMetadata)) {
              const items: ChatMessageContentListItem[] = groundingMetadata.map((block: Anthropic.WebSearchResultBlock) => ({
                url: block.url,
                title: block.title,
                icon: `https://www.google.com/s2/favicons?domain=${block.url}&sz=${128}`,
              })) || [];

              const messageContent = ChatMessageContent.searchResultList({
                items,
              });
              const serverTool = AnthropicUtil.serverTools.find((tool) => tool.name === 'web_search');

              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'server_tool_use_result',
                  message_contents: [messageContent],
                  tool: {
                    name: 'web_search',
                    ...serverTool,
                    id: chunk.content_block.tool_use_id,
                  }
                },
              }

            } else {

            }
          }
        } else if (chunk.type === "content_block_stop") {
          yield {
            type: 'content_block_stop',
          }
        } else if (chunk.type === "content_block_delta") {

          if (chunk.delta.type === "text_delta") {
            yield {
              type: 'content_block_delta',
              delta: chunk.delta
            }
          } else if (chunk.delta.type === "thinking_delta") {
            yield {
              type: 'content_block_delta',
              delta: chunk.delta
            }
          } else if (chunk.delta.type === "signature_delta") {
            yield {
              type: 'content_block_delta',
              delta: chunk.delta
            }
          } else if (chunk.delta.type === "input_json_delta") {
            yield {
              type: 'content_block_delta',
              delta: chunk.delta
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    } finally {
    }
  }

  return new Stream(iterator, controller);
}
