import {
  AttachmentUtils,
  ContextItem,
  ContextUtils,
  FileUtil,
} from "@enconvo/api";

/**
 * Converts a context item to its text representation.
 * Returns the formatted text string for text-based items,
 * or null for image items (screenshot, image files) that need provider-specific handling.
 */
export async function convertContextTypeMessageContent(
  contextItem: ContextItem,
  isAgentMode: boolean,
): Promise<string | null> {
  if (contextItem.type === "im_message") {
    const headerParts = [
      `channel_provider: ${contextItem.channel_provider}`,
      `sender: ${contextItem.author}`,
      `channel_id: ${contextItem.channel_id}`,
    ];
    if (contextItem.user_id) headerParts.push(`user_id: ${contextItem.user_id}`);
    // In DMs, skip message_id so agent sends a plain message instead of a reply
    if (contextItem.message_id && !contextItem.is_dm) headerParts.push(`message_id: ${contextItem.message_id}`);
    if (contextItem.is_dm != null) headerParts.push(`is_dm: ${contextItem.is_dm}`);

    return `[IM message from ${headerParts.join(", ")}]\n${contextItem.content}`;
  }

  if (contextItem.type === "text" || contextItem.type === "selectionText") {
    return `[Context Item] ${JSON.stringify(contextItem)}`;
  }

  if (contextItem.type === "browserTab" || contextItem.type === "window") {
    return `[Context Item] ${JSON.stringify(contextItem)}`;
  }

  if (contextItem.type === "transcript") {
    const newContextItem = await ContextUtils.syncUnloadedContextItem(contextItem);
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
