import { ChatMessageContent } from "@enconvo/api";
import { handleMention } from "./text_utils.ts";



export namespace MessageUtils {

  export const preHandleMessageContent = async (contents: ChatMessageContent[]): Promise<ChatMessageContent[]> => {
    return await Promise.all(contents.map(async (content) => {
      if (content.type === "text") {
        return await handleMention(content)
      }
      return content;
    }));
  }

}
