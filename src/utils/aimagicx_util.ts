import { BaseChatMessageLike, AITool } from "@enconvo/api";

export namespace AimagicxUtil {
  /**
   * Converts Enconvo messages to a single message string for AIMagicX API
   * AIMagicX uses a single 'message' parameter instead of messages array
   */
  export function convertMessagesToSingleMessage(
    messages: BaseChatMessageLike[],
  ): { message: string; system?: string } {
    let systemMessage = "";
    let conversationMessages: string[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Handle system message content extraction
        systemMessage =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
                .map((content) => {
                  if (content.type === "text") {
                    return content.text;
                  } else if (content.type === "search_result_list") {
                    return JSON.stringify(content.items);
                  }
                  return JSON.stringify(content);
                })
                .join("\n\n");
      } else {
        // Handle conversation messages with proper content extraction
        const role = msg.role === "assistant" ? "assistant" : "user";
        let messageContent = "";

        if (typeof msg.content === "string") {
          messageContent = msg.content;
        } else {
          // Extract text and search results from content array
          const textContent = msg.content.map((item) => {
            if (item.type === "text") {
              return item.text;
            } else if (item.type === "search_result_list") {
              return JSON.stringify(item.items);
            }
            return JSON.stringify(item);
          });
          messageContent = textContent.join("\n");
        }
        conversationMessages.push(`${role}: ${messageContent}`);
      }
    }

    // Get the last message as user input
    const lastMessage = conversationMessages.pop();
    const userInput = lastMessage?.split(": ").slice(1).join(": ") || "";

    // Build history from remaining messages
    const history = conversationMessages.join("\n");

    // Construct the final prompt
    const prompt = `history messages:\n${history}\n\nuser input:\n${userInput}`;
    console.log("prompt", prompt);

    const result: { message: string; system?: string } = { message: prompt };
    if (systemMessage) {
      result.system = systemMessage;
    }

    return result;
  }

  /**
   * Converts Enconvo tools to AIMagicX API tools format (simple string array)
   */
  export function convertToolsToAimagicxTools(
    tools?: AITool[],
  ): string[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => tool.name);
  }

  /**
   * Validates API key format for Aimagicx
   */
  export function validateApiKey(apiKey: string): boolean {
    if (!apiKey) {
      return false;
    }

    // Check if it starts with mgx-sk- pattern based on documentation
    return apiKey.startsWith("mgx-sk-") || apiKey.length > 10;
  }

  /**
   * Formats error messages from Aimagicx API
   */
  export function formatApiError(error: any): string {
    if (typeof error === "string") {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    return "Unknown error occurred";
  }

  /**
   * Gets supported model types based on AIMagicX API documentation
   */
  export function getSupportedModels(): string[] {
    return [
      // OpenAI Models
      "4o-mini",
      "4o",
      "gpt-4.1",
      "gpt-4.1-mini",
      "o3",
      "o3-mini",
      // Anthropic Models
      "claude-3-5-sonnet",
      "claude-3-7-sonnet",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      // Google Models
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ];
  }
}
