import { BaseChatMessageLike, FileUtil, LLMProvider } from "@enconvo/api";

export namespace OllamaUtil {
  export const convertMessageToOllamaMessage = async (
    message: BaseChatMessageLike,
    options: LLMProvider.LLMOptions,
  ): Promise<Message> => {
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: message.content,
      };
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

      const text = message.content
        .filter((item) => item.type === "text")
        .map((item) => {
          return item.text;
        })
        .join("\n");

      return {
        role: message.role,
        content: text,
        images: images,
      };
    }
  };

  export const convertMessagesToOllamaMessages = async (
    messages: BaseChatMessageLike[],
    options: LLMProvider.LLMOptions,
  ): Promise<Message[]> => {
    return await Promise.all(
      messages.map((message) =>
        convertMessageToOllamaMessage(message, options),
      ),
    );
  };

  interface Message {
    role: string;
    content: string;
    images?: Uint8Array[] | string[];
    tool_calls?: ToolCall[];
  }

  interface ToolCall {
    function: {
      name: string;
      arguments: {
        [key: string]: any;
      };
    };
  }
}
