import Anthropic from "@anthropic-ai/sdk"
import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, ChatMessageContent, FileUtil, LLMProvider, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"
import fs from "fs"
import path from "path"
import mime from "mime"
export namespace AnthropicUtil {
    export const convertToolsToAnthropicTools = (tools?: LLMTool[]): Anthropic.Tool[] | undefined => {
        if (!tools) {
            return undefined
        }

        let newTools: Anthropic.Tool[] | undefined = tools?.map((tool) => {

            return {
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
                strict: tool.strict,
            }
        })

        return newTools
    }

    export const getNumTokens = async (text: string): Promise<number> => {
        const tokens = text.length / 4
        return tokens
    }

    export const getNumTokensFromMessages = async (messages: Anthropic.Messages.MessageParam[]): Promise<{
        totalCount: number;
        countPerMessage: number[];
    }> => {
        let totalCount = 0;

        const tokensPerMessage = 7;

        let allContent = ''

        messages.map(async (message) => {
            // 如果是message.content 是 string
            if (typeof message.content === 'string') {
                allContent += (message.content + message.role)
                totalCount += tokensPerMessage;
            } else {
                message.content.map((content) => {
                    if (content.type === 'text') {
                        allContent += content.text
                    } else if (content.type === 'tool_use') {
                        allContent += content.name
                        allContent += JSON.stringify(content.input)
                    } else if (content.type === 'tool_result') {
                        allContent += content.tool_use_id
                        if (typeof content.content === 'string') {
                            allContent += content.content
                        } else {
                            content.content?.map((item) => {
                                if (item.type === 'text') {
                                    allContent += item.text
                                } else if (item.type === 'image') {
                                    totalCount += 1500;
                                }
                            })
                        }
                    } else if (content.type === 'image') {
                        totalCount += 1500;
                    }
                })
                totalCount += tokensPerMessage;
            }
            return message;
        })

        const contentTokens = await getNumTokens(allContent)

        totalCount += contentTokens;

        return { totalCount, countPerMessage: [] };
    }
}

type MessageContentType = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam

const convertToolResults = (results: (string | ChatMessageContent)[]) => {
    return results.map((result) => {

        if (typeof result === "string") {
            const text: Anthropic.TextBlockParam = {
                type: "text",
                text: result
            }
            return [text]
        } else if (result.type === "text") {
            const text: Anthropic.TextBlockParam = {
                type: "text",
                text: result.text
            }
            return [text]
        } else if (result.type === "image_url") {
            const url = result.image_url.url
            let parts: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] = []
            if (url.startsWith("file://") && isSupportedImageType(url)) {
                const base64 = FileUtil.convertFileUrlToBase64(url)
                const mimeType = mime.getType(url) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

                parts.push({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": `${mimeType}`,
                        "data": base64
                    }
                })
            }

            parts.push({
                type: "text",
                text: "This is a image file , url is " + result.image_url.url
            })
            return parts
        } else {
            const text: Anthropic.TextBlockParam = {
                type: "text",
                text: JSON.stringify(result)
            }
            return [text]
        }
    }).flat()
}

function isSupportedImageType(url: string) {
    const supportedTypes = ["jpeg", "png", "jpg", "webp"]
    const mimeType = path.extname(url).slice(1)
    return supportedTypes.includes(mimeType)
}



export const convertMessageToAnthropicMessage = (message: BaseChatMessageLike, options: LLMProvider.LLMOptions): Anthropic.Messages.MessageParam[] => {

    let role = message.role

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        // console.log("toolMessage", JSON.stringify(toolMessage, null, 2))
        let content: (string | ChatMessageContent)[] = []
        try {
            content = JSON.parse(toolMessage.content as string)
        } catch (e) {
            console.log("toolMessage content error", toolMessage.content)
        }

        const toolResultMessages = convertToolResults(content)
        return [{
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: toolMessage.tool_call_id,
                    //@ts-ignore
                    content: toolResultMessages,
                    cache_control: {
                        type: "ephemeral"
                    }
                }
            ]
        }]
    }

    if (message.role === "assistant") {
        const aiMessage = message as AssistantMessage

        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {

            let args: any = {}
            try {
                args = JSON.parse(aiMessage.tool_calls[0].function.arguments || '{}')
            } catch (e) {
                console.log("flowParams error", aiMessage.tool_calls[0].function.arguments)
            }

            return [{
                role: "assistant",
                content: [
                    {
                        type: "tool_use",
                        name: aiMessage.tool_calls[0].function.name,
                        id: aiMessage.tool_calls[0].id!,
                        input: args
                    }
                ]
            }]
        }
    }


    if (typeof message.content === "string") {
        return [{
            //@ts-ignore
            role: role,
            content: message.content
        }]
    } else {

        const contents: Anthropic.MessageParam[] = []
        let parts: MessageContentType[] = []

        for (const item of message.content) {
            role = role as 'user' | 'assistant'

            if (item.type === "image_url") {
                const url = item.image_url.url
                // fs exists
                const fileExists = url.startsWith("file://") && fs.existsSync(url.replace("file://", ""))
                console.log("fileExists", fileExists)

                if (role === "user" && url.startsWith("file://") && fileExists && isSupportedImageType(url)) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = mime.getType(url) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
                    parts.push({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": `${mimeType}`,
                            "data": base64
                        }
                    })
                }

                parts.push({
                    type: "text",
                    text: "This is a image file , url is " + url
                })


            } else if (item.type === "flow_step") {

                if (parts.length > 0) {
                    contents.push({
                        role: role,
                        content: parts
                    })
                    parts = []
                }

                const results = item.flowResults.map((message) => {
                    return message.content
                }).flat()


                const toolResultMessages = convertToolResults(results)



                let args = {}
                try {
                    args = JSON.parse(item.flowParams || '{}')
                } catch (e) {
                    console.log("flowParams error", item.flowParams)
                }

                const toolUseMessages: Anthropic.MessageParam[] = [
                    {
                        role: "assistant",
                        content: [
                            {
                                type: "tool_use",
                                name: item.flowName.replace("|", "-"),
                                id: item.flowId,
                                input: args
                            }
                        ]
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "tool_result",
                                tool_use_id: item.flowId,
                                content: toolResultMessages,
                                cache_control: {
                                    type: "ephemeral"
                                }
                            }
                        ]
                    }]

                contents.push(...toolUseMessages)

            } else if (item.type === "text") {
                if (item.text.trim() !== "") {
                    parts.push({
                        type: "text",
                        text: item.text
                    })
                }

            } else if (item.type === "audio") {
                const url = item.file_url.url
                parts.push({
                    type: "text",
                    text: "This is a audio file , url is " + url || ""
                })

            } else if (item.type === "video") {
                const url = item.file_url.url
                parts.push({
                    type: "text",
                    text: "This is a video file , url is " + url || ""
                })
            } else if (item.type === "file") {
                const url = item.file_url.url
                parts.push({
                    type: "text",
                    text: "This is a file , url is " + url || ""
                })
            } else if (item.type === "thinking") {
                // do nothing
            } else {
                parts.push({
                    type: "text",
                    text: JSON.stringify(item)
                })
            }
        }

        if (parts.length > 0) {
            contents.push({
                role: role as 'user' | 'assistant',
                content: parts
            })
            parts = []
        }

        return contents
    }
}

export const convertMessagesToAnthropicMessages = async (messages: BaseChatMessageLike[], options: LLMProvider.LLMOptions): Promise<Anthropic.Messages.MessageParam[]> => {
    let newMessages = messages.map((message) => convertMessageToAnthropicMessage(message, options)).flat().filter((message) => {
        if (typeof message.content === "string" && message.content.trim() === "") {
            console.log("message.content is empty", message)
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

    // count of tool_use
    const toolUseCount = newMessages.filter((message) => {
        if (message.content && Array.isArray(message.content)) {
            return message.content.some((content) => content.type === "tool_use")
        }
        return false
    }).length
    console.log("cache control count", toolUseCount)
    // 如果超过4个，则删除前面的的tool_use的content中的cache_control，保留4个
    if (toolUseCount > 4) {
        let toBeDeleted = toolUseCount - 4
        let index = 0
        newMessages = newMessages.map((message) => {
            if (message.content && Array.isArray(message.content)) {
                message.content = message.content.map((content) => {
                    if (content.type === "tool_result") {
                        index++
                        if (index <= toBeDeleted) {
                            content.cache_control = undefined
                        }
                    }
                    return content
                })
            }
            return message
        })
    }


    // console.log("newMessages", JSON.stringify(newMessages, null, 2))
    // fs.writeFileSync(`${homedir()}/Desktop/newMessages.json`, JSON.stringify(newMessages, null, 2))



    return newMessages
}




export function streamFromAnthropic(response: AsyncIterable<Anthropic.Messages.MessageStreamEvent>, controller: AbortController): Stream<BaseChatMessageChunk> {
    let consumed = false;

    async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
        if (consumed) {
            throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
        }
        consumed = true;
        let done = false;
        try {

            let message: Anthropic.Message
            for await (const chunk of response) {
                if (chunk.type === "message_start") {
                    message = chunk.message
                    console.log("input usage", JSON.stringify(chunk.message.usage, null, 2))
                }

                if (done) continue;

                if (chunk.type === "message_delta") {
                    if (chunk.delta.stop_reason) {
                        let finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null = null
                        if (chunk.delta.stop_reason === "max_tokens") {
                            finish_reason = "length"
                        } else if (chunk.delta.stop_reason === "stop_sequence") {
                            finish_reason = "stop"
                        } else if (chunk.delta.stop_reason === "tool_use") {
                            finish_reason = "tool_calls"
                        } else if (chunk.delta.stop_reason === "end_turn") {
                            finish_reason = "stop"
                        }
                        // console.log("finish_reason", JSON.stringify(chunk.usage, null, 2))

                        yield {
                            model: "Anthropic",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    role: "assistant"
                                },
                                finish_reason: finish_reason,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }
                        done = true;
                        continue
                    }
                }

                // if (chunk.type === "message_stop") {
                //     done = true;
                //     continue
                // }

                if (chunk.type === "content_block_start") {
                    if (chunk.content_block.type === "tool_use") {
                        yield {
                            model: "Anthropic",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    tool_calls: [
                                        {
                                            type: "function",
                                            index: 0,
                                            id: chunk.content_block.id,
                                            function: {
                                                name: chunk.content_block.name,
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

                    }
                }

                if (chunk.type === "content_block_delta") {
                    if (chunk.delta.type === "text_delta") {
                        yield {
                            model: "Anthropic",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    content: chunk.delta.text,
                                    role: "assistant"
                                },
                                finish_reason: null,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }
                    } else if (chunk.delta.type === "thinking_delta") {
                        yield {
                            model: "Anthropic",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    //@ts-ignore
                                    reasoning_content: chunk.delta.thinking,
                                    role: "assistant"
                                },
                                finish_reason: null,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }
                    } else if (chunk.delta.type === "input_json_delta") {
                        yield {
                            model: "Anthropic",
                            id: uuid(),
                            choices: [{
                                delta: {
                                    tool_calls: [
                                        {
                                            index: 0,
                                            function: {
                                                arguments: chunk.delta.partial_json
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

