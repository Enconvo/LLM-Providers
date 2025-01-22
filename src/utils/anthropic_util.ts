import Anthropic from "@anthropic-ai/sdk"
import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"

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

export const convertMessageToAnthropicMessage = (message: BaseChatMessageLike, options: LLMProvider.LLMOptions): Anthropic.Messages.MessageParam[] => {

    let role = message.role

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        return [{
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: toolMessage.tool_call_id,
                    //@ts-ignore
                    content: toolMessage.content
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

        const content: Anthropic.MessageParam[][] = message.content.map((item) => {
            role = role as 'user' | 'assistant'

            if (item.type === "image_url") {
                const url = item.image_url.url
                let parts: MessageContentType[] = []
                if (role === "user" && url.startsWith("file://")) {
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

                return [{
                    role: role,
                    content: parts
                }]

            } else if (item.type === "flow_step") {
                const results = item.flowResults.map((message) => {
                    return message.content
                }).flat()

                let args = {}
                try {
                    args = JSON.parse(item.flowParams || '{}')
                } catch (e) {
                    console.log("flowParams error", item.flowParams)
                }

                return [
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
                                content: JSON.stringify(results)
                            }
                        ]
                    }]

            } else if (item.type === "text") {
                return [{
                    role: role,
                    content: [{
                        type: "text",
                        text: item.text
                    }]
                }]
            } else if (item.type === "audio") {
                const url = item.file_url.url
                return [{
                    role: role,
                    content: [{
                        type: "text",
                        text: "This is a audio file , url is " + url || ""
                    }]
                }]
            } else if (item.type === "video") {
                const url = item.file_url.url
                return [{
                    role: role,
                    content: [{
                        type: "text",
                        text: "This is a video file , url is " + url || ""
                    }]
                }]
            } else if (item.type === "file") {
                const url = item.file_url.url
                return [{
                    role: role,
                    content: [{
                        type: "text",
                        text: "This is a file , url is " + url || ""
                    }]
                }]
            }

            return [{
                role: role,
                content: JSON.stringify(item)
            }]

        })

        return content.flat()
    }
}

export const convertMessagesToAnthropicMessages = (messages: BaseChatMessageLike[], options: LLMProvider.LLMOptions): Anthropic.Messages.MessageParam[] => {
    const newMessages = messages.map((message) => convertMessageToAnthropicMessage(message, options)).flat()
    // console.log("newMessages", JSON.stringify(newMessages, null, 2))
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

