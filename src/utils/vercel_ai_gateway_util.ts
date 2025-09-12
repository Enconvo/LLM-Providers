import {
  AssistantMessage,
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
  ImagePart,
  ModelMessage,
  SystemModelMessage,
  TextPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserContent,
  UserModelMessage,
} from "ai";

export namespace VercelAIGatewayUtil {}

export const convertMessageToVercelFormat = async (
  message: BaseChatMessageLike,
  options: LLMProvider.LLMOptions,
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

    for (const item of message.content) {
      if (item.type === "image_url") {
        let url = item.image_url.url.replace("file://", "");
        if (role === "user" && options.modelName.visionEnable === true) {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            const imagePart: ImagePart = {
              type: "image",
              image: new URL(url),
            };
            //@ts-ignore
            parts.push(imagePart);
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
              parts.push(imagePart);
            }
          }
        }

        if (Runtime.isAgentMode()) {
          const textPart: TextPart = {
            type: "text",
            text: `This is a image file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
          };
          parts.push(textPart);
        }
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
        const url = item.file_url.url;
        parts.push({
          type: "text",
          text: "This is a audio file , url is " + url || "",
        });
      } else if (item.type === "video") {
        const url = item.file_url.url;
        parts.push({
          type: "text",
          text: "This is a video file , url is " + url || "",
        });
      } else if (item.type === "file") {
        const url = item.file_url.url;
        parts.push({
          type: "text",
          text: "This is a file , url is " + url || "",
        });
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
): Promise<ModelMessage[]> => {
  const newMessages = (
    await Promise.all(
      messages.map((message) => convertMessageToVercelFormat(message, options)),
    )
  ).flat();

  console.log("newMessages", JSON.stringify(newMessages, null, 2));

  return newMessages;
};

export function streamFromVercel(
  response: ReadableStream,
): Stream<BaseChatMessageChunk> {
  const controller = new AbortController();

  async function* iterator(): AsyncIterator<
    BaseChatMessageChunk,
    any,
    undefined
  > {
    for await (const part of response) {
      // console.log("textPart", part)
      if (part.type === "text-delta") {
        yield {
          model: "Vercel AI Gateway",
          id: part.id,
          choices: [
            {
              delta: {
                content: part.text,
                role: "assistant",
              },
              finish_reason: null,
              index: 0,
            },
          ],
          created: Date.now(),
          object: "chat.completion.chunk",
        };
      } else if (part.type === "tool-input-start") {
        yield {
          model: "Vercel AI Gateway",
          id: uuid(),
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    type: "function",
                    index: 0,
                    id: part.id,
                    function: {
                      name: part.toolName,
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
      } else if (part.type === "tool-input-delta") {
        yield {
          model: "Vercel AI Gateway",
          id: uuid(),
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: {
                      arguments: part.delta,
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
  }
  return new Stream(iterator, controller);
}
