import {
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ContextItem,
  FileUtil,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import { ChatOpenAIProvider } from "./chat_open_ai.ts";
import { createReadStream } from "fs";
import axios from "axios";
import FormData from "form-data";

export default function main(options: any) {
  return new StraicoProvider(options);
}

export class StraicoProvider extends ChatOpenAIProvider {




  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {


    const messages = await this.handleMessages(content);

    const response = await this.call({ messages: messages });

    async function* iterator(): AsyncIterator<
      BaseChatMessageChunk,
      any,
      undefined
    > {
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
          text: response.text,
        }
      }

      yield {
        type: 'content_block_stop',
      }
    }

    const controller = new AbortController();

    return new Stream(iterator, controller);
  }

  private async handleMessages(
    content: LLMProvider.Params,
  ): Promise<BaseChatMessageLike[]> {
    const messages = content.messages;

    const uploadCache = new Map<string, string>();

    const uploadIfNecessary = async (
      rawUrl: string,
      options: { skipImageCheck?: boolean } = {},
    ): Promise<string> => {
      if (!rawUrl) {
        return rawUrl;
      }
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        return rawUrl;
      }

      const { skipImageCheck = false } = options;
      const sanitizedPath = rawUrl.startsWith("file://")
        ? rawUrl.replace("file://", "")
        : rawUrl;

      if (!skipImageCheck && !FileUtil.isImageFile(sanitizedPath)) {
        return rawUrl;
      }

      if (uploadCache.has(sanitizedPath)) {
        return uploadCache.get(sanitizedPath)!;
      }

      try {
        const uploadedUrl = await this.uploadFile(sanitizedPath);
        if (uploadedUrl) {
          uploadCache.set(sanitizedPath, uploadedUrl);
          return uploadedUrl;
        }
      } catch (error) {
        console.error("Failed to upload file to Straico:", error);
      }

      uploadCache.set(sanitizedPath, rawUrl);
      return rawUrl;
    };

    const processedMessages: BaseChatMessageLike[] = [];
    for (const originalMessage of messages) {
      if (typeof originalMessage.content === "string") {
        processedMessages.push(originalMessage);
        continue;
      }

      if (!Array.isArray(originalMessage.content)) {
        processedMessages.push(originalMessage);
        continue;
      }

      const newContent: any[] = [];
      for (const item of originalMessage.content) {
        if (item?.type === "context" && Array.isArray(item.items)) {
          const newContextItems:ContextItem[] = [];
          for (const contextItem of item.items) {
            if (!contextItem) {
              continue;
            }

            if (contextItem.type === "screenshot") {
              const uploadedUrl = await uploadIfNecessary(contextItem.url, {
                skipImageCheck: true,
              });
              newContextItems.push({
                ...contextItem,
                url: uploadedUrl,
              });
            } else if (contextItem.type === "file") {
              const rawUrl = contextItem.url;
              const sanitizedPath =
                rawUrl?.startsWith("file://")
                  ? rawUrl.replace("file://", "")
                  : rawUrl;

              if (
                rawUrl &&
                !rawUrl.startsWith("http://") &&
                !rawUrl.startsWith("https://") &&
                FileUtil.isImageFile(sanitizedPath)
              ) {
                const uploadedUrl = await uploadIfNecessary(rawUrl);
                newContextItems.push({
                  ...contextItem,
                  url: uploadedUrl,
                });
              } else {
                newContextItems.push(contextItem);
              }
            } else {
              newContextItems.push(contextItem);
            }
          }

          newContent.push({
            ...item,
            items: newContextItems,
          });
          continue;
        }

        if (item?.type === "image_url" && item.image_url?.url) {
          const uploadedUrl = await uploadIfNecessary(item.image_url.url, {
            skipImageCheck: false,
          });
          newContent.push({
            ...item,
            image_url: {
              ...item.image_url,
              url: uploadedUrl,
            },
          });
          continue;
        }

        if (item?.type === "file" && item.file_url?.url) {
          const rawUrl = item.file_url.url;
          const sanitizedPath = rawUrl.startsWith("file://")
            ? rawUrl.replace("file://", "")
            : rawUrl;

          if (
            !rawUrl.startsWith("http://") &&
            !rawUrl.startsWith("https://") &&
            FileUtil.isImageFile(sanitizedPath)
          ) {
            const uploadedUrl = await uploadIfNecessary(rawUrl);
            newContent.push({
              ...item,
              file_url: {
                ...item.file_url,
                url: uploadedUrl,
              },
            });
            continue;
          }
        }

        newContent.push(item);
      }

      const processedMessage: BaseChatMessageLike = {
        ...originalMessage,
        content: newContent,
      };
      processedMessages.push(processedMessage);
    }

    return processedMessages;
  }


  private async uploadFile(fileUrl: string): Promise<string> {
    var data = new FormData();
    const file = createReadStream(fileUrl.replaceAll("file://", ""));
    data.append("file", file);

    var config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.straico.com/v0/file/upload",
      headers: {
        Authorization: `Bearer ${this.options.credentials?.apiKey}`,
        "Content-Type": "multipart/form-data",
        ...data.getHeaders(),
      },
      data: data,
    };

    try {
      const response = await axios(config);
      return response.data.data.url;
    } catch (error) {
      console.log(error);
      return "";
    }
  }
}
