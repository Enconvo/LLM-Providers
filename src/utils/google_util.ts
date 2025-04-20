import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, ChatMessageContent, environment, FileUtil, LLMProvider, LLMTool, Runtime, Stream, ToolMessage, uuid } from "@enconvo/api"
import path from "path"
import { writeFile } from "fs/promises"
import fs from "fs"

import mime from "mime"
import { Content, Part, FunctionDeclaration, Tool, GenerateContentResponse } from "@google/genai"
export namespace GoogleUtil {


    export const convertToolsToGoogleTools = (tools?: LLMTool[]): Tool[] | undefined => {
        if (!tools || tools.length === 0) {
            return undefined
        }

        let functionDeclarations: FunctionDeclaration[] | undefined = tools?.map((tool) => {

            Object.entries(tool.parameters?.properties || {}).forEach(([key, value]: [string, any]) => {
                // Recursively check and remove additionalProperties from nested objects
                const removeAdditionalProps = (obj: any) => {
                    if (typeof obj !== 'object') return;

                    // Delete additionalProperties if present
                    delete obj.default;
                    delete obj.additionalProperties;
                    delete obj['$schema'];
                    delete obj.exclusiveMaximum;
                    delete obj.exclusiveMinimum;

                    delete obj.format;
                    // Recursively process nested properties
                    Object.values(obj).forEach(val => {
                        if (typeof val === 'object') {
                            removeAdditionalProps(val);
                        }
                    });
                };

                removeAdditionalProps(value);
            });

            delete tool.parameters?.additionalProperties;
            delete tool.parameters?.$schema

            if (Object.keys(tool.parameters?.properties || {}).length === 0) {
                delete tool.parameters
            }

            const functionDeclarationTool: FunctionDeclaration = {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
            return functionDeclarationTool
        })

        const functionDeclarationTool: Tool = {
            functionDeclarations: functionDeclarations
        }

        return [functionDeclarationTool]
    }
}



function convertRole(role: BaseChatMessage["role"]) {
    if (role === "user") {
        return "user"
    } else if (role === "assistant") {
        return "model"
    } else if (role === "system") {
        return "user"
    }
    return "user"
}

function isSupportedImageType(url: string) {
    const supportedTypes = ["jpeg", 'jpg', "png", "webp"]
    const mimeType = path.extname(url).slice(1)
    return supportedTypes.includes(mimeType)
}

const convertToolResults = (results: (string | ChatMessageContent)[], options: LLMProvider.LLMOptions) => {
    if (typeof results !== "string") {
        const contents = results as ChatMessageContent[]
        // Convert array content to messages, extracting images into separate message
        let messageContents: Part[] = []

        // Process each content item
        for (const item of contents) {
            if (item.type === 'image_url') {
                // Handle image content
                const url = item.image_url.url
                if (url.startsWith("file://") && options.modelName.visionEnable && isSupportedImageType(url)) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = mime.getType(url)
                    messageContents.push({
                        inlineData: {
                            data: base64,
                            mimeType: mimeType as string
                        },
                    })
                }
                messageContents.push({
                    text: "This is a image file , url is " + url
                })
            }
        }

        if (messageContents.length > 0) {
            const imageMessage: Content = {
                role: "user",
                parts: messageContents
            }

            return [imageMessage]
        }
        return []
    }
    return []
}

export const convertMessageToGoogleMessage = (message: BaseChatMessageLike, options: LLMProvider.LLMOptions): Content[] => {

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        let response: (string | ChatMessageContent)[] = []
        try {
            response = JSON.parse(message.content as string)
        } catch (e) {
            console.log("toolMessage content error", message.content)
        }

        const toolAdditionalMessages = convertToolResults(response, options)

        const content: Content = {
            role: "function",
            parts: [
                {
                    functionResponse: {
                        name: toolMessage.tool_name,
                        response: {
                            content: response
                        }
                    }
                }
            ]
        }
        return [content, ...toolAdditionalMessages]
    }

    if (message.role === "assistant") {
        const aiMessage = message as AssistantMessage
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {


            let args = {}
            try {
                args = JSON.parse(aiMessage.tool_calls[0].function.arguments)
            } catch (e) {
                console.error(e)
            }

            const content: Content = {
                role: convertRole(message.role),
                parts: [
                    {
                        functionCall: {
                            name: aiMessage.tool_calls[0].function.name,
                            args: args
                        }
                    }
                ]
            }
            return [content]
        }
    }

    if (typeof message.content === "string") {
        const content: Content = {
            role: convertRole(message.role),
            parts: [{
                text: message.content
            }]
        }
        return [content]
    } else {
        let parts: Part[] = []
        const contents: Content[] = []
        const isAgentMode = Runtime.isAgentMode() && options.modelName.toolUse === true
        for (const item of message.content) {
            if (item.type === "image_url") {
                const url = item.image_url.url
                const mimeType = mime.getType(url)
                const fileExists = url.startsWith("file://") && fs.existsSync(url.replace("file://", ""))

                if (url.startsWith("file://") && options.modelName.visionEnable === true && fileExists && isSupportedImageType(url)) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const image: Part = {
                        inlineData: {
                            data: base64,
                            mimeType: mimeType as string
                        },
                    }
                    parts.push(image)
                }


                if (isAgentMode) {
                    const text: Part = {
                        text: "This is a image file , url is " + url
                    }

                    parts.push(text)
                }

            } else if (item.type === "flow_step") {

                let args = {}
                try {
                    args = JSON.parse(item.flowParams || '{}')
                } catch (e) {
                    console.log("flowParams error", item.flowParams)
                }


                const results = item.flowResults.map((message) => {
                    return message.content
                }).flat()



                if (options.modelName.toolUse === true) {

                    if (parts.length > 0) {
                        contents.push({
                            role: convertRole(message.role),
                            parts: parts
                        })
                        parts = []
                    }

                    const functionCall: Content = {
                        role: convertRole(message.role),
                        parts: [
                            {
                                functionCall: {
                                    name: item.flowName,
                                    args: args
                                }
                            }
                        ]
                    }

                    const functionResponse: Content = {
                        role: "function",
                        parts: [
                            {
                                functionResponse: {
                                    name: item.flowName,
                                    response: {
                                        content: {
                                            content: results
                                        }
                                    }
                                }
                            }
                        ]
                    }

                    contents.push(functionCall)
                    contents.push(functionResponse)

                    const toolAdditionalMessages = convertToolResults(results, options)
                    contents.push(...toolAdditionalMessages)
                } else {
                    parts.push({
                        text: "This is a function call , name is " + item.flowName + " , args is " + JSON.stringify(args) + " , results is " + JSON.stringify(results)
                    })
                }

            } else if (item.type === "text") {
                if (item.text.trim() !== "") {
                    parts.push({
                        text: item.text
                    })
                }
            } else if (item.type === "audio") {
                const url = item.file_url.url
                const mimeType = path.extname(url).slice(1)
                // Check if the audio format is supported by Gemini
                function isSupportAudioType(mimeType: string): boolean {
                    const supportedFormats = ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'];
                    return supportedFormats.includes(mimeType)
                }
                const isSupport = isSupportAudioType(mimeType)
                if (message.role === "user" && url.startsWith("file://") && options.modelName.audioEnable === true && isSupport) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const audio: Part = {
                        inlineData: {
                            data: base64,
                            mimeType: `audio/${mimeType}`
                        },
                    }
                    parts.push(audio)
                }

                parts.push({
                    text: "This is a audio file , url is " + url
                })

            } else if (item.type === "video") {
                const url = item.file_url.url
                const mimeType = path.extname(url).slice(1)

                function isSupportAudioType(mimeType: string): boolean {
                    const supportedFormats = ['mp4'];
                    return supportedFormats.includes(mimeType)
                }
                const isSupport = isSupportAudioType(mimeType)
                if (message.role === "user" && url.startsWith("file://") && options.modelName.videoEnable === true && isSupport) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const video: Part = {
                        inlineData: {
                            data: base64,
                            mimeType: `video/${mimeType}`
                        },
                    }
                    parts.push(video)
                }

                const text: Part = {
                    text: "This is a video file , url is " + url
                }
                parts.push(text)

            } else if (item.type === "file") {
                const url = item.file_url.url

                parts.push({
                    text: "This is a file , url is " + url
                })
            } else if (item.type === "thinking") {
                // do nothing
            } else {
                const text: Content = {
                    role: convertRole(message.role),
                    parts: [{
                        text: JSON.stringify(item)
                    }]
                }
                contents.push(text)
            }
        }

        if (parts.length > 0) {
            contents.push({
                role: convertRole(message.role),
                parts: parts
            })
            parts = []
        }

        return contents
    }
}

export const convertMessagesToGoogleMessages = (messages: BaseChatMessageLike[], options: LLMProvider.LLMOptions): Content[] => {
    const newMessages = messages.map((message) => convertMessageToGoogleMessage(message, options)).flat()
    console.log("newMessages", JSON.stringify(newMessages, null, 2))
    return newMessages
}

async function saveBinaryFile(fileName: string, content: Buffer) {
    await writeFile(fileName, content);
}


export function streamFromGoogle(response: AsyncGenerator<GenerateContentResponse, any, any>, controller: AbortController): Stream<BaseChatMessageChunk> {
    let consumed = false;

    async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
        if (consumed) {
            throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
        }
        consumed = true;
        let done = false;
        try {
            for await (const chunk of response) {
                console.log("google chunk", JSON.stringify(chunk, null, 2))
                if (done) continue;
                const candidate = chunk.candidates?.[0]
                if (candidate?.finishReason === "STOP") {
                    done = true;
                }

                const functionCalls = chunk.functionCalls

                if (functionCalls && functionCalls.length > 0) {
                    const functionCall = functionCalls[0]
                    yield {
                        model: "Google",
                        id: uuid(),
                        choices: [{
                            delta: {
                                tool_calls: [
                                    {
                                        type: "function",
                                        index: 0,
                                        id: uuid(),
                                        function: {
                                            name: functionCall.name,
                                            arguments: JSON.stringify(functionCall.args)
                                        }
                                    }
                                ],
                                role: "assistant"
                            },
                            finish_reason: null,
                            index: 0
                        }],
                        created: Date.now(),
                        object: "chat.completion.chunk"
                    }

                } else {

                    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                        const fileName = uuid();
                        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
                        let fileExtension = mime.getExtension(inlineData.mimeType || '');
                        let buffer = Buffer.from(inlineData.data || '', 'base64');

                        const cachePath = environment.cachePath
                        const filePath = path.join(cachePath, `${fileName}.${fileExtension}`)
                        await saveBinaryFile(filePath, buffer);

                        yield {
                            model: "Google",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    message_content: ChatMessageContent.imageUrl({ url: "file://" + filePath }),
                                    role: "assistant"
                                },
                                finish_reason: null,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }

                    } else {

                        yield {
                            model: "Google",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    content: chunk.text,
                                    role: "assistant"
                                },
                                finish_reason: null,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }
                    }
                }

            }
            done = true;
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            throw e;
        } finally {
            if (!done) controller.abort();
        }
    }

    return new Stream(iterator, controller);
}
