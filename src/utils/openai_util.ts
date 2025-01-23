import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, LLMTool, Stream } from "@enconvo/api"
import OpenAI from "openai"
import path from "path"



export namespace OpenAIUtil {
    export const convertMessageToOpenAIMessage = (options: LLMProvider.LLMOptions, message: BaseChatMessageLike): OpenAI.Chat.ChatCompletionMessageParam[] => {
        let role = message.role
        if (options.modelName.systemMessageEnable === false && message.role === "system") {
            role = "user"
        }

        if (message.role === "tool") {
            //@ts-ignore
            return [message]
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

                    if (role === "user" && url.startsWith("file://") && options.modelName.visionEnable === true) {
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

                        newMessages.push(...msgs)
                    } else {
                        messageContents.push({
                            type: "text",
                            text: "This is a tool call , name is " + item.flowName + " , args is " + JSON.stringify(item.flowParams) + " , results is " + JSON.stringify(results)
                        })
                    }

                } else if (item.type === "text") {

                    messageContents.push({
                        type: "text",
                        text: item.text
                    })

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

            if (options.modelName.sequenceContentDisable) {
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

        return newTools
    }

    export const convertMessagesToOpenAIMessages = (options: LLMProvider.LLMOptions, messages: BaseChatMessageLike[]): OpenAI.Chat.ChatCompletionMessageParam[] => {

        if (options.modelName.visionImageCountLimit !== undefined && options.modelName.visionImageCountLimit > 0 && options.modelName.visionEnable === true) {
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

        console.log("newMessages", JSON.stringify(newMessages, null, 2))

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