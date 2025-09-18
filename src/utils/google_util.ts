import {
  AssistantMessage,
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
  ToolMessage,
  uuid,
  ChatMessageContentListItem,
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
  if (message.role === "tool") {
    const toolMessage = message as ToolMessage;
    let response: (string | ChatMessageContent)[] = [];
    try {
      response = JSON.parse(message.content as string);
    } catch (e) {
      console.log("toolMessage content error", message.content);
    }

    const content: Content = {
      role: "function",
      parts: [
        {
          functionResponse: {
            name: toolMessage.tool_name,
            response: {
              content: response,
            },
          },
        },
      ],
    };
    return [content];
  }

  if (message.role === "assistant") {
    const aiMessage = message as AssistantMessage;
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      let args = {};
      try {
        args = JSON.parse(aiMessage.tool_calls[0].function.arguments);
      } catch (e) {
        console.error(e);
      }

      const content: Content = {
        role: convertRole(message.role),
        parts: [
          {
            functionCall: {
              name: aiMessage.tool_calls[0].function.name,
              args: args,
            },
          },
        ],
      };
      return [content];
    }
  }

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
    for (const item of message.content) {
      if (item.type === "image_url") {
        let url = item.image_url.url.replace("file://", "");
        url = await ImageUtil.compressImage(url);
        const mimeType = mime.getType(url);
        const base64 = await FileUtil.convertUrlToBase64(url);
        if (options.modelName.visionEnable === true && base64) {
          const image: Part = {
            inlineData: {
              data: base64,
              mimeType: mimeType as string,
            },
          };
          parts.push(image);
        }

        if (isAgentMode || params.imageGenerationToolEnabled !== 'disabled') {
          const text: Part = {
            text: `This is a image file , url is ${url} , only used for reference when you use tool, if not , ignore this .`,
          };

          parts.push(text);
        }
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

          const functionCall: Content = {
            role: convertRole(message.role),
            parts: [
              {
                functionCall: {
                  name: item.flowName,
                  args: args,
                },
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
          });
        }
      } else if (item.type === "audio") {
        const url = item.file_url.url;
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
          };
          parts.push(audio);
        }

        if (isAgentMode) {
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
            };
            parts.push(video);
          }
        }

        const text: Part = {
          text:
            "This is a video file , url is " +
            url +
            " , only used for reference when you use tool, if not , ignore this .",
        };
        parts.push(text);
      } else if (item.type === "file") {
        const url = item.file_url.url;

        parts.push({
          text:
            "This is a file , url is " +
            url +
            " , only used for reference when you use tool, if not , ignore this .",
        });
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
  const newMessages = (
    await Promise.all(
      messages.map((message) =>
        convertMessageToGoogleMessage(message, options, params),
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
    try {
      for await (const chunk of response) {
        // console.log("google chunk", JSON.stringify(chunk, null, 2))
        if (done) continue;
        const candidate = chunk.candidates?.[0];

        const functionCalls = chunk.functionCalls;
        const groundingMetadata = candidate?.groundingMetadata;

        if (candidate?.finishReason === "STOP") {
          done = true;
        } else if (candidate?.finishReason === FinishReason.PROHIBITED_CONTENT) {
          done = true;
          yield {
            model: "Google",
            id: uuid(),
            choices: [
              {
                delta: {
                  content: "The content is prohibited",
                  role: "assistant",
                },
                finish_reason: "content_filter",
                index: 0,
              },
            ],
            created: Date.now(),
            object: "chat.completion.chunk",
          };
        }

        if (functionCalls && functionCalls.length > 0) {
          const functionCall = functionCalls[0];
          yield {
            model: "Google",
            id: uuid(),
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      type: "function",
                      index: 0,
                      id: uuid(),
                      function: {
                        name: functionCall.name,
                        arguments: JSON.stringify(functionCall.args),
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
                model: "Google",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      message_content: ChatMessageContent.imageUrl({
                        url: filePath,
                      }),
                      role: "assistant",
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
                created: Date.now(),
                object: "chat.completion.chunk",
              };
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
                model: "Google",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      message_content: ChatMessageContent.audio({
                        url: filePath,
                      }),
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
          } else {
            if (content?.thought === true) {
              yield {
                model: "Google",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      //@ts-ignore
                      reasoning_content: content?.text,
                      role: "assistant",
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
                created: Date.now(),
                object: "chat.completion.chunk",
              };
            } else if (content?.text && content?.text !== "") {
              yield {
                model: "Google",
                id: uuid(),
                choices: [
                  {
                    delta: {
                      content: chunk.text,
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
            model: "Google",
            id: uuid(),
            choices: [
              {
                delta: {
                  message_content: messageContent,
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
      done = true;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    } finally {
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

