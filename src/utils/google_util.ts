import {
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  environment,
  FileUtil,
  ImageUtil,
  LLMProvider,
  AITool,
  Runtime,
  Stream,
  uuid,
  ChatMessageContentListItem,
  AttachmentUtils,
  ContextUtils,
  CacheUtils
} from "@enconvo/api";
import path from "path";
import { writeFile } from "fs/promises";
import wav from "wav";

import mime from "mime";

import {
  Content,
  Part,
  FunctionDeclaration,
  Tool,
  GenerateContentResponse,
  FinishReason,
  GroundingMetadata,
} from "@google/genai";
export namespace GoogleUtil {
  export const convertToolsToGoogleTools = (
    tools?: AITool[],
  ): Tool[] | undefined => {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    // List of supported fields from Google Gemini Schema interface
    const supportedFields = new Set([
      "anyOf",
      "default",
      "description",
      "enum",
      "example",
      "format",
      "items",
      "maxItems",
      "maxLength",
      "maxProperties",
      "maximum",
      "minItems",
      "minLength",
      "minProperties",
      "minimum",
      "nullable",
      "pattern",
      "properties",
      "propertyOrdering",
      "required",
      "title",
      "type",
    ]);
    let functionDeclarations: FunctionDeclaration[] | undefined = tools?.map(
      (tool) => {
        // console.log("tool", tool.name, tool.parameters?.properties)

        Object.entries(tool.parameters?.properties || {}).forEach(
          ([_, value]: [string, any]) => {
            // Recursively check and remove additionalProperties from nested objects
            const removeAdditionalProps = (obj: any) => {
              if (typeof obj !== "object" || obj === null) return;
              // Remove all unsupported fields
              Object.keys(obj).forEach((key) => {
                if (!supportedFields.has(key)) {
                  // console.log("delete key", key)
                  delete obj[key];
                }
              });

              // Handle array items
              if (obj.items) {
                removeAdditionalProps(obj.items);
              }

              // Handle anyOf schemas (Google supports anyOf but not allOf/oneOf)
              if (obj.anyOf && Array.isArray(obj.anyOf)) {
                obj.anyOf.forEach((schema: any) => {
                  removeAdditionalProps(schema);
                });
              }

              // Handle object properties
              if (obj.properties && typeof obj.properties === "object") {
                Object.values(obj.properties).forEach((prop) => {
                  removeAdditionalProps(prop);
                });
              }
            };

            removeAdditionalProps(value);
          },
        );

        // // Remove all unsupported fields
        delete tool.parameters?.additionalProperties;
        delete tool.parameters?.$schema;

        if (Object.keys(tool.parameters?.properties || {}).length === 0) {
          delete tool.parameters;
        }

        const functionDeclarationTool: FunctionDeclaration = {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        };
        return functionDeclarationTool;
      },
    );

    const functionDeclarationTool: Tool = {
      functionDeclarations: functionDeclarations,
    };

    return [functionDeclarationTool];
  };
}

function convertRole(role: BaseChatMessage["role"]) {
  if (role === "user") {
    return "user";
  } else if (role === "assistant") {
    return "model";
  } else if (role === "system") {
    return "user";
  }
  return "user";
}

export const convertMessageToGoogleMessage = async (
  message: BaseChatMessageLike,
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<Content[]> => {


  if (typeof message.content === "string") {
    const content: Content = {
      role: convertRole(message.role),
      parts: [
        {
          text: message.content,
        },
      ],
    };
    return [content];
  } else {
    let parts: Part[] = [];
    const contents: Content[] = [];
    const isAgentMode = Runtime.isAgentMode();

    async function handleImageContentItem({ url, description, thoughtSignature }: { url: string; description?: string, thoughtSignature?: string }) {
      const newParts: Part[] = [];
      url = await ImageUtil.compressImage(url);
      const mimeType = mime.getType(url);
      const base64 = await FileUtil.convertUrlToBase64(url);
      if (options.modelName.visionEnable === true && base64) {
        const image: Part = {
          inlineData: {
            data: base64,
            mimeType: mimeType as string,
          },
          thoughtSignature: thoughtSignature,
        };
        newParts.push(image);
      }

      if (description) {
        const text: Part = {
          text: description,
        };
        newParts.push(text);
      } else {
        const imageGenerationToolEnabled = params.imageGenerationToolEnabled && params.imageGenerationToolEnabled !== 'disabled';
        const videoGenerationToolEnabled = params.videoGenerationToolEnabled && params.videoGenerationToolEnabled !== 'disabled';
        if ((isAgentMode || imageGenerationToolEnabled || videoGenerationToolEnabled) && params.addImageAdditionalInfo !== false) {
          const text: Part = {
            text: `The above image's url is ${url} , only used for reference when you use tool.`,
          };

          newParts.push(text);
        }
      }
      return newParts;
    }

    for (const item of message.content) {
      if (item.type === "context") {
        const contextItems = item.items;
        for (const contextItem of contextItems) {
          if (contextItem.type === "screenshot") {
            const description = `[Context Item] This is a screenshot, url is ${contextItem.url}`;
            const newParts = await handleImageContentItem({ url: contextItem.url, description });
            parts.push(...newParts);
          } else if (
            contextItem.type === "text" ||
            contextItem.type === "selectionText"
          ) {
            const textPart: Part = {
              text: `[Context Item] ${JSON.stringify(contextItem)}`,
            };
            parts.push(textPart);
          } else if (
            contextItem.type === "browserTab" ||
            contextItem.type === "window"
          ) {
            const textPart: Part = {
              text: `[Context Item] ${JSON.stringify(contextItem)}`,
            };
            parts.push(textPart);
          } else if (contextItem.type === "file") {
            const url = contextItem.url.replace("file://", "");
            if (FileUtil.isImageFile(url)) {
              const description = `[Context Item] This is a image file , url is ${url}`;
              const newParts = await handleImageContentItem({ url, description });
              parts.push(...newParts);
            } else {
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
                const newItem = {
                  ...contextItem,
                  content: text,
                };
                parts.push({
                  text: `[Context Item] ${JSON.stringify(newItem)}`,
                });
              } else {
                parts.push({
                  text: `[Context Item] ${JSON.stringify(contextItem)}`,
                });
              }
            }
          } else if (contextItem.type === "transcript") {
            const newContextItem = await ContextUtils.syncUnloadedContextItem(contextItem);
            parts.push({
              text: `[Context Item] ${JSON.stringify(newContextItem)}`,
            });
          }
        }
      } else if (item.type === "image_url") {
        let url = item.image_url.url.replace("file://", "");
        const newParts = await handleImageContentItem({ url, thoughtSignature: item.thought_signature });
        parts.push(...newParts);
      } else if (item.type === "flow_step") {
        let args = {};
        try {
          args = JSON.parse(item.flowParams || "{}");
        } catch (e) {
          console.log("flowParams error", item.flowParams);
        }

        const results = item.flowResults
          .map((message) => {
            return message.content;
          })
          .flat();

        if (options.modelName.toolUse === true) {
          if (parts.length > 0) {
            contents.push({
              role: convertRole(message.role),
              parts: parts,
            });
            parts = [];
          }

          const thoughtSignature = item.thought_signature || CacheUtils.get(item.flowName) as string | undefined;
          // console.log("thoughtSignature", thoughtSignature)
          const functionCall: Content = {
            role: convertRole(message.role),
            parts: [
              {
                functionCall: {
                  name: item.flowName,
                  args: args,
                },
                thoughtSignature: thoughtSignature,
              },
            ],
          };

          const functionResponse: Content = {
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: item.flowName,
                  response: {
                    content: {
                      content: results,
                    },
                  },
                },
              },
            ],
          };

          contents.push(functionCall);
          contents.push(functionResponse);
        } else {
          parts.push({
            text:
              "This is a function call , name is " +
              item.flowName +
              " , args is " +
              JSON.stringify(args) +
              " , results is " +
              JSON.stringify(results),
          });
        }
      } else if (item.type === "text") {
        if (item.text.trim() !== "") {
          parts.push({
            text: item.text,
            thoughtSignature: item.thought_signature,
          });
        }
      } else if (item.type === "audio") {
        const url = item.file_url.url.replace("file://", "");
        const mimeType = mime.getType(url);
        const base64 = await FileUtil.convertUrlToBase64(url);
        if (
          message.role === "user" &&
          options.modelName.audioEnable === true &&
          mimeType &&
          base64
        ) {
          const audio: Part = {
            inlineData: {
              data: base64,
              mimeType: mimeType,
            },
            thoughtSignature: item.thought_signature,
          };
          parts.push(audio);
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
            text: `# audio file url: ${url}\n # audio file transcript: ${text}`,
          });
        } else {
          parts.push({
            text:
              "This is a audio file , url is " +
              url +
              " , only used for reference when you use tool, if not , ignore this .",
          });
        }
      } else if (item.type === "video") {
        const url = item.file_url.url.replace("file://", "");
        const mimeType = mime.getType(url);

        if (message.role === "user" && options.modelName.videoEnable === true) {
          const base64 = await FileUtil.convertUrlToBase64(url);
          if (base64) {
            const video: Part = {
              inlineData: {
                data: base64,
                mimeType: mimeType as string,
              },
              thoughtSignature: item.thought_signature,
            };
            parts.push(video);
          }
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
            text: `# video file url: ${url}\n # video file transcript: ${text}`,
          });
        } else {
          parts.push({
            text:
              "This is a video file , url is " +
              url +
              " , only used for reference when you use tool, if not , ignore this .",
          });
        }
      } else if (item.type === "file") {
        const url = item.file_url.url.replace("file://", "");
        if (FileUtil.isImageFile(url)) {
          const newParts = await handleImageContentItem({ url, thoughtSignature: item.thought_signature });
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
            text: `# file url: ${url}\n # file content: ${text}`,
          });
        } else {
          parts.push({
            text:
              "This is a file , url is " +
              url +
              " , only used for reference when you use tool, if not , ignore this .",
          });
        }
      } else if (item.type === "thinking") {
        // do nothing
      } else {
        const text: Content = {
          role: convertRole(message.role),
          parts: [
            {
              text: JSON.stringify(item),
            },
          ],
        };
        contents.push(text);
      }
    }

    if (parts.length > 0) {
      contents.push({
        role: convertRole(message.role),
        parts: parts,
      });
      parts = [];
    }

    return contents;
  }
};

export const convertMessagesToGoogleMessages = async (
  messages: BaseChatMessageLike[],
  options: LLMProvider.LLMOptions,
  params: LLMProvider.Params,
): Promise<Content[]> => {
  // console.log("convertMessagesToGoogleMessages messages", JSON.stringify(messages, null, 2))
  const newMessages = (
    await Promise.all(
      messages.map(async (message) => {
        return await convertMessageToGoogleMessage(message, options, params)
      }
      ),
    )
  ).flat();
  // console.log("google newMessages", JSON.stringify(newMessages, null, 2));
  return newMessages;
};

export async function saveBinaryFile(fileName: string, content: Buffer) {
  await writeFile(fileName, content);
}

export async function saveWaveFile(
  filename: string,
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("finish", resolve);
    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
}

export function streamFromGoogle(
  response: AsyncGenerator<GenerateContentResponse, any, any>,
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
    let done = false;
    let runningContentBlockType: BaseChatMessageChunk.ContentBlock['type'] | undefined;
    try {
      for await (const chunk of response) {
        console.log("google chunk", JSON.stringify(chunk, null, 2))
        if (done) continue;
        const candidate = chunk.candidates?.[0];

        const functionCalls = chunk.functionCalls;
        const groundingMetadata = candidate?.groundingMetadata;
        const thoughtSignature = candidate?.content?.parts?.[0]?.thoughtSignature;

        if (candidate?.finishReason === "MAX_TOKENS") {
          done = true;
          yield {
            type: 'content_block_stop',
            finish_reason: 'max_tokens'
          };
        } else if (candidate?.finishReason === "STOP") {
          done = true;
        } else if (candidate?.finishReason === FinishReason.PROHIBITED_CONTENT) {
          done = true;
          yield {
            type: 'content_block_start',
            content_block: {
              type: 'message_content',
              content: [
                {
                  type: 'error',
                  text: 'The content is prohibited',
                  id: uuid()
                }
              ]
            }
          };
        }

        if (functionCalls && functionCalls.length > 0) {
          if (runningContentBlockType !== 'tool_use') {
            if (runningContentBlockType !== undefined) {
              yield {
                type: 'content_block_stop',
              }
            }
            runningContentBlockType = 'tool_use';

            const functionCall = functionCalls[0];

            yield {
              type: 'content_block_start',
              content_block: {
                type: 'tool_use',
                thought_signature: thoughtSignature,
                name: functionCall.name || "",
                input: functionCall.args || {},
                id: functionCall.id || ""
              }
            }
          }
        } else {
          // console.log("chunk", JSON.stringify(chunk, null, 2))
          const content = chunk.candidates?.[0]?.content?.parts?.[0];
          const inlineData = content?.inlineData;
          if (inlineData) {
            const isImage = chunk.usageMetadata?.candidatesTokensDetails?.some(
              (detail) => detail.modality === "IMAGE",
            );
            const isAudio = chunk.usageMetadata?.candidatesTokensDetails?.some(
              (detail) => detail.modality === "AUDIO",
            );
            if (isImage) {
              const fileName = uuid();
              let fileExtension = mime.getExtension(inlineData.mimeType || "");
              let buffer = Buffer.from(inlineData.data || "", "base64");

              const cachePath = environment.cachePath;
              const filePath = path.join(
                cachePath,
                `${fileName}.${fileExtension}`,
              );
              await saveBinaryFile(filePath, buffer);

              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'message_content',
                  content: [
                    ChatMessageContent.imageUrl({
                      thought_signature: thoughtSignature,
                      url: filePath,
                    })
                  ]
                }
              }
            } else if (isAudio) {
              const fileName = uuid();
              let fileExtension = "wav";
              let buffer = Buffer.from(inlineData.data || "", "base64");

              const cachePath = environment.cachePath;
              const filePath = path.join(
                cachePath,
                `${fileName}.${fileExtension}`,
              );
              await saveWaveFile(filePath, buffer);

              yield {
                type: 'content_block_start',
                content_block: {
                  type: 'message_content',
                  content: [
                    ChatMessageContent.audio({
                      url: filePath,
                      thought_signature: thoughtSignature,
                    })
                  ]
                }
              }
            }
          } else {
            if (content?.thought === true) {
              if (runningContentBlockType !== 'thinking') {
                if (runningContentBlockType !== undefined) {
                  yield {
                    type: 'content_block_stop',
                  }
                }
                runningContentBlockType = 'thinking';
                yield {
                  type: 'content_block_start',
                  content_block: {
                    type: 'thinking',
                    thinking: content?.text || "",
                  }
                }
              } else if (runningContentBlockType === 'thinking') {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'thinking_delta',
                    thinking: content?.text || "",
                  }
                }
              }
            } else if (content?.text && content?.text !== "") {
              console.log("content?.text", content?.text, runningContentBlockType)
              if (runningContentBlockType !== 'text') {
                if (runningContentBlockType !== undefined) {
                  yield {
                    type: 'content_block_stop',
                  }
                }
                runningContentBlockType = 'text';
                yield {
                  type: 'content_block_start',
                  content_block: {
                    type: 'text',
                    text:  "",
                    thought_signature: thoughtSignature,
                  }
                }
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'text_delta',
                    text: content?.text || "",
                  }
                }
              } else if (runningContentBlockType === 'text') {
                yield {
                  type: 'content_block_delta',
                  delta: {
                    type: 'text_delta',
                    text: content?.text || "",
                  }
                }
              }
            }
          }
        }


        if (groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0) {

          const items: ChatMessageContentListItem[] = groundingMetadata.groundingChunks?.map(chunk => ({
            url: chunk.web?.uri || "",
            title: chunk.web?.title || "",
            user: chunk.web?.domain || "",
            icon: `https://www.google.com/s2/favicons?domain=${chunk.web?.domain}&sz=${128}`,
          })) || [];
          const aiResult = addCitations(groundingMetadata);

          const messageContent = ChatMessageContent.searchResultList({
            items,
            aiResult
          });

          yield {
            type: 'content_block_start',
            content_block: {
              type: 'message_content',
              content: [
                messageContent
              ]
            }
          }

        }
      }
      done = true;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    } finally {
      if (runningContentBlockType !== undefined) {
        yield {
          type: 'content_block_stop',
        }
      }
      if (!done) controller.abort();
    }
  }

  return new Stream(iterator, controller);
}


function addCitations(groundingMetadata: GroundingMetadata) {
  const supports = groundingMetadata.groundingSupports || [];
  const chunks = groundingMetadata.groundingChunks || []

  let text = supports.map(support => {
    const text = support.segment?.text;
    return text
  }).join()

  // Sort supports by end_index in descending order to avoid shifting issues when inserting.
  const sortedSupports = [...supports].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0),
  );

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue;
    }

    const citationLinks = support.groundingChunkIndices
      .map(i => {
        const uri = chunks[i]?.web?.uri;
        if (uri) {
          return `[${i + 1}](${uri})`;
        }
        return null;
      })
      .filter(Boolean);

    if (citationLinks.length > 0) {
      const citationString = citationLinks.join(", ");
      text = text.slice(0, endIndex) + citationString + text.slice(endIndex);
    }
  }

  return text;
}
