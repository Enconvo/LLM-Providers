import Google, { FunctionDeclaration, FunctionDeclarationsTool } from "@google/generative-ai"
import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"
import path from "path"


export namespace GoogleUtil {

    export const convertToolsToGoogleTools = (tools?: LLMTool[]): FunctionDeclarationsTool[] | undefined => {
        if (!tools) {
            return undefined
        }


        let functionDeclarations: FunctionDeclaration[] | undefined = tools?.map((tool) => {

            Object.entries(tool.parameters?.properties || {}).forEach(([key, value]: [string, any]) => {
                // Recursively check and remove additionalProperties from nested objects
                const removeAdditionalProps = (obj: any) => {
                    if (typeof obj !== 'object') return;

                    // Delete additionalProperties if present
                    delete obj.default;

                    // Recursively process nested properties
                    Object.values(obj).forEach(val => {
                        if (typeof val === 'object') {
                            removeAdditionalProps(val);
                        }
                    });
                };

                removeAdditionalProps(value);
            });

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

        const functionDeclarationTool = {
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



export const convertMessageToGoogleMessage = (message: BaseChatMessageLike, options: LLMProvider.LLMOptions): Google.Content[] => {

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        let response = {}
        try {
            response = JSON.parse(toolMessage.content as string)
        } catch (e) {
            console.error(e)
        }

        const content: Google.Content = {
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
        return [content]
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

            const content: Google.Content = {
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
        const content: Google.Content = {
            role: convertRole(message.role),
            parts: [{
                text: message.content
            }]
        }
        return [content]
    } else {
        const content: Google.Content[][] = message.content.map((item) => {
            if (item.type === "image_url") {
                const url = item.image_url.url
                const mimeType = path.extname(url).slice(1)
                let parts: Google.Part[] = []
                if (message.role === "user" && url.startsWith("file://") && options.modelName.visionEnable === true) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const image: Google.Part = {
                        inlineData: {
                            data: base64,
                            mimeType: `image/${mimeType}`
                        },
                    }
                    parts.push(image)
                }
                const text: Google.Part = {
                    text: "type:image_url , url:" + url
                }

                parts.push(text)

                const content: Google.Content = {
                    role: convertRole(message.role),
                    parts: parts
                }
                return [content]
            } else if (item.type === "flow_step") {

                let args = {}
                try {
                    args = JSON.parse(item.flowParams || '{}')
                } catch (e) {
                    console.log("flowParams error", item.flowParams)
                }

                const functionCall: Google.Content = {
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

                const results = item.flowResults.map((message) => {
                    return message.content
                }).flat()

                const functionResponse: Google.Content = {
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

                return [functionCall, functionResponse]

            } else if (item.type === "text") {
                const text: Google.Content = {
                    role: convertRole(message.role),
                    parts: [{
                        text: item.text
                    }]
                }
                return [text]
            } else if (item.type === "audio") {
                const url = item.file_url.url
                const mimeType = path.extname(url).slice(1)
                // Check if the audio format is supported by Gemini
                function isSupportAudioType(mimeType: string): boolean {
                    const supportedFormats = ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'];
                    return supportedFormats.includes(mimeType)
                }
                const isSupport = isSupportAudioType(mimeType)
                let parts: Google.Part[] = []
                if (message.role === "user" && url.startsWith("file://") && options.modelName.audioEnable === true && isSupport) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const audio: Google.Part = {
                        inlineData: {
                            data: base64,
                            mimeType: `audio/${mimeType}`
                        },
                    }
                    parts.push(audio)
                }

                const text: Google.Part = {
                    text: "type:audio , url:" + url
                }
                parts.push(text)

                const content: Google.Content = {
                    role: convertRole(message.role),
                    parts: parts
                }
                return [content]
            } else if (item.type === "video") {
                const url = item.file_url.url
                const mimeType = path.extname(url).slice(1)

                function isSupportAudioType(mimeType: string): boolean {
                    const supportedFormats = ['mp4'];
                    return supportedFormats.includes(mimeType)
                }
                const isSupport = isSupportAudioType(mimeType)
                let parts: Google.Part[] = []
                if (message.role === "user" && url.startsWith("file://") && options.modelName.videoEnable === true && isSupport) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const video: Google.Part = {
                        inlineData: {
                            data: base64,
                            mimeType: `video/${mimeType}`
                        },
                    }
                    parts.push(video)
                }

                const text: Google.Part = {
                    text: "type:video , url:" + url
                }
                parts.push(text)

                const content: Google.Content = {
                    role: convertRole(message.role),
                    parts: parts
                }
                return [content]
            }
            else if (item.type === "file") {
                const url = item.file_url.url
                let parts: Google.Part[] = []

                const text: Google.Part = {
                    text: "type:file , url:" + url
                }
                parts.push(text)

                const content: Google.Content = {
                    role: convertRole(message.role),
                    parts: parts
                }
                return [content]
            }

            const text: Google.Content = {
                role: convertRole(message.role),
                parts: [{
                    text: JSON.stringify(item)
                }]
            }
            return [text]
        })

        return content.flat()
    }
}

export const convertMessagesToGoogleMessages = (messages: BaseChatMessageLike[], options: LLMProvider.LLMOptions): Google.Content[] => {
    // console.log("messages", JSON.stringify(messages, null, 2))

    const newMessages = messages.map((message) => convertMessageToGoogleMessage(message, options)).flat()
    console.log("newMessages", JSON.stringify(newMessages, null, 2))
    return newMessages
}



export function streamFromGoogle(response: AsyncIterable<Google.EnhancedGenerateContentResponse>, controller: AbortController): Stream<BaseChatMessageChunk> {
    let consumed = false;

    async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
        if (consumed) {
            throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
        }
        consumed = true;
        let done = false;
        try {
            for await (const chunk of response) {
                // console.log("google chunk", JSON.stringify(chunk, null, 2))
                if (done) continue;
                const candidate = chunk.candidates?.[0]
                if (candidate?.finishReason === "STOP") {
                    done = true;
                }


                const functionCalls = chunk.functionCalls()

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

                    yield {
                        model: "Google",
                        id: uuid(),
                        choices: [{
                            delta: {
                                content: chunk.text(),
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
