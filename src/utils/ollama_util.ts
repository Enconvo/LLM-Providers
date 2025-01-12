import { BaseChatMessageLike, FileUtil } from "@enconvo/api"

export namespace OllamaUtil {



    export const convertMessageToOllamaMessage = (message: BaseChatMessageLike): Message => {

        if (typeof message.content === "string") {
            return {
                role: message.role,
                content: message.content
            }
        } else {

            const images = message.content.filter((item) => item.type === "image_url").map((item) => {
                if (item.type === "image_url") {
                    const url = item.image_url.url
                    if (url.startsWith("file://")) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        return base64
                    }
                }
                return ""
            }).filter((item) => item !== "")

            const text = message.content.filter((item) => item.type === "text").map((item) => {
                return item.text
            }).join("\n")

            return {
                role: message.role,
                content: text,
                images: images
            }
        }
    }

    export const convertMessagesToOllamaMessages = (messages: BaseChatMessageLike[]): Message[] => {
        return messages.map((message) => convertMessageToOllamaMessage(message))
    }






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