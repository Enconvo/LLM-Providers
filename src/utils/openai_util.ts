import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, ChatMessageContent, FileUtil, LLMProvider, LLMTool, Stream } from "@enconvo/api"
import OpenAI from "openai"
import path from "path"
import fs from "fs"
export namespace OpenAIUtil {

    function isSupportedImageType(url: string) {
        const supportedTypes = ["jpeg", "jpg", "png", "webp"]
        const mimeType = path.extname(url).toLowerCase().slice(1)
        return supportedTypes.includes(mimeType)
    }

    const convertToolResults = (results: (string | ChatMessageContent)[], options: LLMProvider.LLMOptions) => {
        if (typeof results !== "string") {
            const contents = results as ChatMessageContent[]
            // Convert array content to messages, extracting images into separate message
            let messageContents: OpenAI.Chat.ChatCompletionContentPart[] = []

            // Process each content item
            for (const item of contents) {
                if (item.type === 'image_url') {
                    // Handle image content
                    const url = item.image_url.url
                    if (url.startsWith("file://") && options.modelName.visionEnable && isSupportedImageType(url)) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        const mimeType = url.split(".").pop()
                        messageContents.push({
                            type: "image_url",
                            image_url: {
                                url: `data:image/${mimeType};base64,${base64}`
                            }
                        })
                    }

                    messageContents.push({
                        type: "text",
                        text: "This is a image file , url is " + url
                    })
                }
            }

            if (messageContents.length > 0) {
                const imageMessage: OpenAI.Chat.ChatCompletionMessageParam = {
                    role: "user",
                    content: messageContents
                }

                return [imageMessage]
            }
            return []
        }
        return []
    }

    export const convertMessageToOpenAIMessage = (options: LLMProvider.LLMOptions, message: BaseChatMessageLike): OpenAI.Chat.ChatCompletionMessageParam[] => {
        let role = message.role
        if (options.modelName && options.modelName.systemMessageEnable === false && message.role === "system") {
            message.role = "user"
            const assistantMessage: AssistantMessage = BaseChatMessage.assistant('Got it , I will follow your instructions')

            //@ts-ignore
            return [message, assistantMessage]
        }

        if (message.role === "tool") {
            let content: (string | ChatMessageContent)[] = []
            try {
                content = JSON.parse(message.content as string)
            } catch (e) {
                console.log("toolMessage content error", message.content)
            }

            const toolAdditionalMessages = convertToolResults(content, options)

            //@ts-ignore
            return [message, ...toolAdditionalMessages]
        }


        if (message.role === "assistant") {
            const aiMessage = message as AssistantMessage
            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                //@ts-ignore
                return [aiMessage]
            }
        }


        if (typeof message.content === "string") {
            return [
                //@ts-ignore
                {
                    role: role,
                    content: message.content
                }
            ]
        } else {
            let newMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
            let messageContents: OpenAI.Chat.ChatCompletionContentPart[] = []

            for (const item of message.content) {
                let role = message.role as 'user' | 'assistant'
                if (item.type === "image_url") {
                    const url = item.image_url.url

                    const fileExists = url.startsWith("file://") && fs.existsSync(url.replace("file://", ""))

                    if (role === "user" && url.startsWith("file://") && options.modelName.visionEnable === true && fileExists && isSupportedImageType(url)) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        const mimeType = url.split(".").pop()
                        messageContents.push({
                            type: "image_url",
                            image_url: {
                                url: `data:image/${mimeType};base64,${base64}`
                            }
                        })
                    }

                    messageContents.push({
                        type: "text",
                        text: "This is a image file , url is " + url
                    })

                } else if (item.type === "flow_step") {




                    const results = item.flowResults.map((message) => {
                        return message.content
                    }).flat()


                    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
                        {
                            role: "assistant",
                            tool_calls: [
                                {
                                    type: "function",
                                    id: item.flowId,
                                    function: {
                                        name: item.flowName.replace("|", "-"),
                                        arguments: item.flowParams || ''
                                    }
                                }
                            ]
                        }
                        ,
                        {
                            role: "tool",
                            tool_call_id: item.flowId,
                            content: JSON.stringify(results)
                        }]

                    if (options.modelName.toolUse === true) {

                        if (messageContents.length > 0) {
                            //@ts-ignore
                            newMessages.push({
                                role: role,
                                content: messageContents
                            })
                            messageContents = []
                        }

                        const toolAdditionalMessages = convertToolResults(results, options)

                        newMessages.push(...msgs, ...toolAdditionalMessages)
                    } else {
                        messageContents.push({
                            type: "text",
                            text: "This is a tool call , name is " + item.flowName + " , args is " + JSON.stringify(item.flowParams) + " , results is " + JSON.stringify(results)
                        })
                    }

                } else if (item.type === "text") {

                    if (item.text.trim() !== "") {
                        messageContents.push({
                            type: "text",
                            text: item.text
                        })
                    }

                } else if (item.type === "audio") {
                    function isSupportAudioType(mimeType: string): boolean {
                        return mimeType === "mp3" || mimeType === "wav"
                    }
                    const url = item.file_url.url
                    const mimeType = path.extname(url).slice(1)
                    const isSupport = isSupportAudioType(mimeType)
                    if (role === "user" && url.startsWith("file://") && options.modelName.audioEnable === true && isSupport) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        messageContents.push({
                            type: "input_audio",
                            input_audio: {
                                data: base64,
                                format: mimeType as "mp3" | "wav"
                            }
                        })
                    } else {
                        messageContents.push({
                            type: "text",
                            text: "This is a audio file , url is " + url || ""
                        })
                    }

                } else if (item.type === "video") {
                    const url = item.file_url.url
                    messageContents.push({
                        type: "text",
                        text: "This is a video file , url is " + url || ""
                    })
                } else if (item.type === "file") {
                    const url = item.file_url.url
                    messageContents.push({
                        type: "text",
                        text: "This is a file , url is " + url || ""
                    })
                } else if (item.type === "thinking") {
                    // do nothing

                } else {
                    messageContents.push({
                        type: "text",
                        text: JSON.stringify(item)
                    })
                }
            }

            if (messageContents.length > 0) {
                //@ts-ignore
                newMessages.push({
                    role: role,
                    content: messageContents
                })
            }

            const modelName = options.modelName.value.toLowerCase()
            const isDeepSeekR1 = modelName.includes("deepseek")

            if (options.modelName.sequenceContentDisable || isDeepSeekR1) {
                newMessages = newMessages.map((message) => {
                    if (typeof message.content === "string") {
                        return message
                    } else {
                        message.content = message.content?.map((item) => {
                            if (item.type === "text") {
                                return item.text
                            }
                            return JSON.stringify(item)
                        }).join("\n")
                    }
                    return message
                })
            }

            return newMessages
        }
    }


    export const convertToolsToOpenAITools = (tools?: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] | undefined => {
        if (!tools) {
            return undefined
        }

        let newTools: OpenAI.Chat.ChatCompletionTool[] | undefined = tools?.map((tool) => {
            if (tool.parameters === undefined || tool.parameters?.type === undefined || tool.parameters?.properties === undefined) {
                tool.parameters = {
                    type: "object",
                    properties: {},
                    required: []
                }
            }

            return {
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                    strict: tool.strict
                }
            }
        })

        // console.log("newTools", JSON.stringify(newTools, null, 2))

        return newTools
    }

    export const convertMessagesToOpenAIMessages = (options: LLMProvider.LLMOptions, messages: BaseChatMessageLike[]): OpenAI.Chat.ChatCompletionMessageParam[] => {

        if (options.modelName && (options.modelName.visionImageCountLimit !== undefined && options.modelName.visionImageCountLimit > 0 && options.modelName.visionEnable === true)) {
            if (options.modelName.visionImageCountLimit !== undefined && options.modelName.visionEnable === true) {
                const countLimit = options.modelName.visionImageCountLimit;
                let imageCount = 0;

                //@ts-ignore
                messages = messages.reverse().map(message => {
                    if (typeof message.content !== "string") {
                        const filteredContent = message.content.filter(item => {
                            if (item.type === "image_url" && imageCount < countLimit) {
                                imageCount++;
                                return true;
                            }
                            return item.type !== "image_url";
                        }).reverse();

                        return { ...message, content: filteredContent };
                    }
                    return message;
                }).reverse();

                imageCount = 0;
                messages = messages.filter(message => {
                    if (typeof message.content !== "string" && message.content.some(item => item.type === "image_url")) {
                        if (imageCount < countLimit) {
                            imageCount++;
                            return true;
                        }
                        return false;
                    }
                    return true;
                });
            }
        }

        let newMessages = messages.map((message) => convertMessageToOpenAIMessage(options, message)).flat().filter((message) => {
            if (typeof message.content === "string" && message.content === "") {
                return false
            } else {
                return message.content?.length !== 0
            }
        }).map((message) => {
            // If content is an array with single text item, convert it to string
            if (message.content && Array.isArray(message.content) && message.content.length === 1 && message.content[0].type === "text") {
                message.content = message.content[0].text
            }


            return message
        })

        const allSystemMessages = newMessages.filter((message) => message.role === "system")
        const allUserMessages = newMessages.filter((message) => message.role !== "system")

        const systemMessage = allSystemMessages.length > 1 ? {
            role: "system",
            content: allSystemMessages.map((message) => {
                if (typeof message.content === "string") {
                    return message.content
                } else {
                    return message.content.map((item) => {
                        if (item.type === "text") {
                            return item.text
                        }
                    }).join("\n\n")
                }
            }).join("\n\n")
        } : allSystemMessages.length > 0 ? allSystemMessages[0] : undefined

        //@ts-ignore
        newMessages = [...(systemMessage ? [systemMessage] : []), ...allUserMessages]
        // ensure first message is user
        function ensureFirstMessageIsUser(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
            // ensure first message is user
            let checked = false
            const firstMessageRole = messages[0]?.role
            const secondMessageRole = messages[1]?.role

            if (firstMessageRole === "assistant" || firstMessageRole === "tool") {
                messages.shift()
                checked = true
            } else if (firstMessageRole === "system" && (secondMessageRole === "assistant" || secondMessageRole === "tool")) {
                // remove the second message
                messages.splice(1, 1)
                checked = true
            }

            if (checked) {
                return ensureFirstMessageIsUser(messages)
            }
            return messages
        }

        newMessages = ensureFirstMessageIsUser(newMessages)

        // console.log("newMessages", JSON.stringify(newMessages, null, 2))
        return newMessages
    }



    export function streamFromOpenAI(response: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>, controller: AbortController): Stream<BaseChatMessageChunk> {
        let consumed = false;

        async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
            if (consumed) {
                throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const chunk of response) {
                    if (done) continue;
                    yield chunk
                }
                done = true;
            } catch (e) {
                console.log(e)
                if (e instanceof Error && e.name === 'AbortError') return;
                throw e;
            } finally {
                if (!done) controller.abort();
            }
        }

        const stream = new Stream(iterator, controller);

        return stream
    }
}