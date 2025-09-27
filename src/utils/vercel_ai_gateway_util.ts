import {
  AssistantMessage,
  AttachmentUtils,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  FileUtil,
  ImageUtil,
  LLMProvider,
  Runtime,
  Stream,
  SystemMessage,
  ToolMessage,
  uuid,
} from "@enconvo/api";
import mime from "mime";

import {
  AssistantContent,
  AssistantModelMessage,
  AsyncIterableStream,
  ImagePart,
  ModelMessage,
  StreamTextResult,
  SystemModelMessage,
  TextPart,
  TextStreamPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  ToolSet,
  UserContent,
  UserModelMessage,
} from "ai";

export namespace VercelAIGatewayUtil { }

export const convertMessageToVercelFormat = async (
  message: BaseChatMessageLike,
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<ModelMessage[]> => {
  let role = message.role;

  if (message.role === "tool") {
    const toolMessage = message as ToolMessage;
    const contentString = toolMessage.content as string;

    let toolResultMessage: ToolResultPart = {
      type: "tool-result",
      toolCallId: toolMessage.tool_call_id,
      toolName: toolMessage.tool_name,
      output: {
        type: "text",
        value: contentString,
      },
    };

    const toolModelMessage: ToolModelMessage = {
      role: "tool",
      content: [toolResultMessage],
    };
    return [toolModelMessage];
  } else if (message.role === "system") {
    const systemMessage = message as SystemMessage;
    const contentString =
      typeof systemMessage.content === "string"
        ? systemMessage.content
        : systemMessage.content
          .map((item) => {
            if (item.type === "text") {
              return item.text;
            }
            return JSON.stringify(item);
          })
          .join("\n\n");
    const newModelMessage: SystemModelMessage = {
      role: "system",
      content: contentString,
    };
    return [newModelMessage];
  }

  if (message.role === "assistant") {
    const aiMessage = message as AssistantMessage;

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      let args: any = {};
      try {
        const contentString =
          aiMessage.tool_calls[0].function.arguments || "{}";
        args = JSON.parse(contentString);
      } catch (e) {
        console.log(
          "flowParams error",
          aiMessage.tool_calls[0].function.arguments,
        );
      }

      const toolCallPart: ToolCallPart = {
        type: "tool-call",
        toolCallId: aiMessage.tool_calls[0].id!,
        toolName: aiMessage.tool_calls[0].function.name,
        input: args,
      };

      const toolUseMessage: AssistantModelMessage = {
        role: "assistant",
        content: [toolCallPart],
      };

      return [toolUseMessage];
    }
  }

  role = role as "user" | "assistant";
  if (typeof message.content === "string") {
    const modelMessage: ModelMessage = {
      role: role as "user" | "assistant",
      content: message.content,
    };
    return [modelMessage];
  } else {
    const contents: (
      | UserModelMessage
      | AssistantModelMessage
      | ToolModelMessage
    )[] = [];
    let parts: UserContent | AssistantContent = [];
    const isAgentMode = Runtime.isAgentMode();

    async function handleImageContentItem(url: string) {
      const newParts: UserContent | AssistantContent = [];
      if (role === "user" && options.modelName.visionEnable === true) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          const imagePart: ImagePart = {
            type: "image",
            image: new URL(url),
          };
          //@ts-ignore
          newParts.push(imagePart);
        } else {
          url = await ImageUtil.compressImage(url);

          console.log("url", url);
          const base64 = FileUtil.convertFileUrlToBase64(url);
          if (base64) {
            const mimeType =
              (mime.getType(url) as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp") || "image/png";
            const imagePart: ImagePart = {
              type: "image",
              image: `data:${mimeType};base64,${base64}`,
            };
            //@ts-ignore
            newParts.push(imagePart);
          }
        }
      }

      const imageGenerationToolEnabled = params.imageGenerationToolEnabled && params.imageGenerationToolEnabled !== 'disabled';
      const videoGenerationToolEnabled = params.videoGenerationToolEnabled && params.videoGenerationToolEnabled !== 'disabled';
      if ((Runtime.isAgentMode() || imageGenerationToolEnabled || videoGenerationToolEnabled) && params.addImageAdditionalInfo !== false) {
        const textPart: TextPart = {
          type: "text",
          text: `The above image's url is ${url} , only used for reference when you use tool.`,
        };
        //@ts-ignore
        newParts.push(textPart);
      }
      return newParts;
    }

    for (const item of message.content) {
      if (item.type === "image_url") {
        let url = item.image_url.url.replace("file://", "");
        const newParts = await handleImageContentItem(url);
        //@ts-ignore
        parts.push(...newParts);
      } else if (item.type === "flow_step") {
        if (parts.length > 0) {
          const modelMessage = {
            role: role as "user" | "assistant",
            content: parts,
          };
          contents.push(
            modelMessage as UserModelMessage | AssistantModelMessage,
          );
          parts = [];
        }

        const results = item.flowResults
          .map((message) => {
            return message.content;
          })
          .flat();

        let args = {};
        try {
          args = JSON.parse(item.flowParams || "{}");
        } catch (e) {
          console.log("flowParams error", item.flowParams);
        }

        const toolUseMessage: ToolCallPart = {
          type: "tool-call",
          toolName: item.flowName.replace("|", "-"),
          toolCallId: item.flowId,
          input: args,
        };

        const toolResultMessage: ToolResultPart = {
          type: "tool-result",
          toolCallId: item.flowId,
          toolName: item.flowName.replace("|", "-"),
          output: {
            type: "text",
            value: JSON.stringify(results),
          },
        };

        const toolUseMessages: (AssistantModelMessage | ToolModelMessage)[] = [
          {
            role: "assistant",
            content: [toolUseMessage],
          },
          {
            role: "tool",
            content: [toolResultMessage],
          },
        ];

        contents.push(...toolUseMessages);
      } else if (item.type === "text") {
        if (item.text.trim() !== "") {
          parts.push({
            type: "text",
            text: item.text,
          });
        }
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
        if (FileUtil.isImageFile(url)) {
          const newParts = await handleImageContentItem(url);

          //@ts-ignore
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
      } else if (item.type === "thinking") {
        // do nothing
      } else {
        parts.push({
          type: "text",
          text: JSON.stringify(item),
        });
      }
    }

    if (parts.length > 0) {
      const modelMessage = {
        role: role as "user" | "assistant",
        content: parts,
      };
      contents.push(modelMessage as UserModelMessage | AssistantModelMessage);
      parts = [];
    }

    return contents;
  }
};

export const convertMessagesToVercelFormat = async (
  messages: BaseChatMessageLike[],
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<ModelMessage[]> => {
  const newMessages = (
    await Promise.all(
      messages.map((message) => convertMessageToVercelFormat(message, options, params)),
    )
  ).flat();

  console.log("vercel newMessages", JSON.stringify(newMessages, null, 2));

  return newMessages;
};

export function streamFromVercel(
  response: StreamTextResult<ToolSet, never>,
): Stream<BaseChatMessageChunk> {
  const controller = new AbortController();

  async function* iterator(): AsyncIterator<
    BaseChatMessageChunk,
    any,
    undefined
  > {
    for await (const part of response.fullStream) {
      if (part.type === "text-start") {
        yield {
          type: "content_block_start",
          content_block: {
            type: "text",
            text: '',
          },
        };
      } else if (part.type === "text-delta") {
        yield {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: part.text,
          },
        };
      } else if (part.type === "text-end") {
        yield {
          type: "content_block_stop",
        };

      } else if (part.type === "tool-input-start") {
        yield {
          type: "content_block_start",
          content_block: {
            type: "tool_use",
            name: part.toolName,
            input: {},
            id: part.id,
          },
        };
      } else if (part.type === "tool-input-delta") {
        yield {
          type: "content_block_delta",
          delta: {
            type: "input_json_delta",
            partial_json: part.delta,
          },
        };
      } else if (part.type === "tool-input-end") {
        yield {
          type: "content_block_stop",
        };
      }
    }
  }
  return new Stream(iterator, controller);
}
