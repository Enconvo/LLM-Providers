import {
  AttachmentUtils,
  ContextItem,
  ContextUtils,
  FileUtil,
} from "@enconvo/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function nestedUrl(value: unknown, key: string): string {
  if (!isRecord(value)) {
    return "";
  }
  const nested = value[key];
  if (!isRecord(nested)) {
    return "";
  }
  return typeof nested.url === "string" ? nested.url : "";
}

function listItemTitle(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }
  if (typeof item.title === "string" && item.title.length > 0) {
    return item.title;
  }
  return typeof item.type === "string" ? item.type : "";
}

function messageContentPartToText(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (!isRecord(part)) {
    return stringifyValue(part);
  }

  const type = typeof part.type === "string" ? part.type : "";
  if (type === "text") {
    return typeof part.text === "string" ? part.text : "";
  }
  if (type === "image_url") {
    return `[image: ${nestedUrl(part, "image_url")}]`;
  }
  if (type === "file" || type === "audio" || type === "video") {
    return `[${type}: ${nestedUrl(part, "file_url")}]`;
  }
  if (type === "context") {
    const items = Array.isArray(part.items)
      ? part.items.map(listItemTitle).filter(Boolean).join(", ")
      : "";
    return items ? `[context: ${items}]` : "[context]";
  }
  if (type === "flow_step") {
    const title = typeof part.title === "string" ? part.title : "Tool";
    const status =
      typeof part.flowRunStatus === "string" ? ` (${part.flowRunStatus})` : "";
    return `[tool: ${title}${status}]`;
  }
  if (type === "tool_use") {
    const name = typeof part.name === "string" ? part.name : "tool";
    return `[tool: ${name}]`;
  }
  if (type === "search_result_list" || type === "browser_tab_list") {
    const items = Array.isArray(part.items)
      ? part.items.map(listItemTitle).filter(Boolean).join(", ")
      : "";
    return items ? `[${type}: ${items}]` : `[${type}]`;
  }
  if (type === "thinking" || type === "loading_indicator") {
    return "";
  }
  if (typeof part.text === "string") {
    return part.text;
  }
  return stringifyValue(part);
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(messageContentPartToText).filter(Boolean).join("\n");
  }
  return "";
}

function messageToText(message: unknown): string {
  if (!isRecord(message)) {
    return stringifyValue(message);
  }
  const role = typeof message.role === "string" ? message.role : "message";
  const text = messageContentToText(message.content);
  return text ? `${role}: ${text}` : `${role}:`;
}

function messagesContextToText(contextItem: Record<string, unknown>): string {
  const title =
    typeof contextItem.title === "string" ? ` ${contextItem.title}` : "";
  const header = `[Context Messages]${title}`;
  const messages = Array.isArray(contextItem.content)
    ? contextItem.content.map(messageToText).filter(Boolean).join("\n\n")
    : "";
  return messages ? `${header}\n${messages}` : header;
}

/**
 * Converts a context item to its text representation.
 * Returns the formatted text string for text-based items,
 * or null for image items (screenshot, image files) that need provider-specific handling.
 */
export async function convertContextTypeMessageContent(
  contextItem: ContextItem,
  isAgentMode: boolean,
): Promise<string | null> {
  const contextRecord = contextItem as unknown as Record<string, unknown>;
  if (contextRecord.type === "messages") {
    return messagesContextToText(contextRecord);
  }

  if (contextItem.type === "im_message") {
    const headerParts = [
      `channel_provider: ${contextItem.channel_provider}`,
      `sender: ${contextItem.author}`,
      `channel_id: ${contextItem.channel_id}`,
    ];
    if (contextItem.user_id)
      headerParts.push(`user_id: ${contextItem.user_id}`);
    // In DMs, skip message_id so agent sends a plain message instead of a reply
    if (contextItem.message_id && !contextItem.is_dm)
      headerParts.push(`message_id: ${contextItem.message_id}`);
    if (contextItem.is_dm != null)
      headerParts.push(`is_dm: ${contextItem.is_dm}`);

    return `[IM message from ${headerParts.join(", ")}]\n${contextItem.content}`;
  }

  if (contextItem.type === "text" || contextItem.type === "selectionText") {
    return `[Context Item] ${JSON.stringify(contextItem)}`;
  }

  if (contextItem.type === "browserTab" || contextItem.type === "window") {
    return `[Context Item] ${JSON.stringify(contextItem)}`;
  }

  if (contextItem.type === "transcript") {
    const newContextItem =
      await ContextUtils.syncUnloadedContextItem(contextItem);
    return `[Context Item] ${JSON.stringify(newContextItem)}`;
  }

  if (contextItem.type === "file") {
    const url = contextItem.url.replace("file://", "");
    if (FileUtil.isImageFile(url)) {
      return null; // image files need provider-specific handling
    }

    const readableContent = isAgentMode
      ? []
      : await AttachmentUtils.getAttachmentsReadableContent({
          files: [url],
          loading: true,
        });

    if (readableContent.length > 0) {
      const text = readableContent[0].contents
        .map((item: any) => item.text)
        .join("\n");
      const newItem = { ...contextItem, content: text };
      return `[Context Item] ${JSON.stringify(newItem)}`;
    }
    return `[Context Item] ${JSON.stringify(contextItem)}`;
  }

  if (contextItem.type === "screenshot") {
    return null; // screenshots need provider-specific image handling
  }

  // Fallback for unknown types
  return `[Context Item] ${JSON.stringify(contextItem)}`;
}
