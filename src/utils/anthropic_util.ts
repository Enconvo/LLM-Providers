import Anthropic from "@anthropic-ai/sdk"
import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, ChatMessageContent, FileUtil, LLMProvider, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"
import fs from "fs"
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
                strict: tool.strict
            }
        })

        return newTools
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
            if (url.startsWith("file://")) {
                const base64 = FileUtil.convertFileUrlToBase64(url)
                const mimeType = `image/${url.split(".").pop()}` as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
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
                    content: toolResultMessages
                }
            ]
        }]
    }

    if (message.role === "assistant") {
        const aiMessage = message as AssistantMessage

        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {

            let args = {}
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

                if (role === "user" && url.startsWith("file://") && fileExists) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = `image/${url.split(".").pop()}` as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
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
                                content: toolResultMessages
                            }
                        ]
                    }]

                contents.push(...toolUseMessages)

            } else if (item.type === "text") {
                parts.push({
                    type: "text",
                    text: item.text
                })

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

export const convertMessagesToAnthropicMessages = (messages: BaseChatMessageLike[], options: LLMProvider.LLMOptions): Anthropic.Messages.MessageParam[] => {
    const newMessages = messages.map((message) => convertMessageToAnthropicMessage(message, options)).flat()
    console.log("newMessages", JSON.stringify(newMessages, null, 2))
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
                }

                if (done) continue;

                if (chunk.type === "message_stop") {
                    done = true;
                    continue
                }

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

