import Anthropic from "@anthropic-ai/sdk"
import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"

export namespace AnthropicUtil {
    export const convertToolsToAnthropicTools = (tools?: LLMTool[]): Anthropic.Tool[] | undefined => {
        if (!tools) {
            return undefined
        }

        let newTools: Anthropic.Tool[] | undefined = tools?.map((tool) => {

            const requestedParameters = tool.parameters ? Object.entries(tool.parameters).reduce((acc, [key, value]) => {
                if (value.required === true) {
                    delete value.required
                    acc.push(key);
                }
                return acc;
            }, [] as string[]) : []


            return {
                name: tool.id.replace("|", "-"),
                description: tool.description,
                input_schema: {
                    type: "object",
                    properties: tool.parameters,
                    required: requestedParameters
                },
                strict: tool.strict
            }
        })

        return newTools
    }
}
export const convertMessageToAnthropicMessage = (message: BaseChatMessageLike): Anthropic.Messages.MessageParam => {

    let role = message.role

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        return {
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: toolMessage.tool_call_id,
                    //@ts-ignore
                    content: toolMessage.content
                }
            ]
        }
    }

    if (message.role === "assistant") {
        const aiMessage = message as AssistantMessage

        console.log('aiMessage', JSON.stringify(aiMessage, null, 2))

        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            return {
                role: "assistant",
                content: [
                    {
                        type: "tool_use",
                        name: aiMessage.tool_calls[0].function.name,
                        id: aiMessage.tool_calls[0].id!,
                        input: {}
                    }
                ]
            }
        }
    }


    if (typeof message.content === "string") {
        return {
            //@ts-ignore
            role: role,
            content: message.content
        }
    } else {

        const content = message.content.filter((item) => {
            let filter = item.type === "text" || item.type === "flow_step" || item.type === "image_url"
            return filter
        }).map((item) => {
            if (item.type === "image_url") {
                const url = item.image_url.url
                if (role === "user" && url.startsWith("file://")) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = url.split(".").pop()
                    return {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": `image/${mimeType}`,
                            "data": base64
                        }
                    }
                } else {
                    return {
                        type: "text",
                        content: "type:image_url , url:" + url
                    }
                }
            } else if (item.type === "flow_step") {
                return {
                    type: "text",
                    content: `type:tool_use, \n tool_name: ${item.title}\ntool_params: ${item.flowParams}\ntool_result: ${JSON.stringify(item.flowResults)}`
                }
            }

            return item
        })


        if (message.content.length === 1 && message.content[0].type === "text") {
            return {
                //@ts-ignore
                role: role,
                content: message.content[0].text
            }
        }



        return {
            //@ts-ignore
            role: role,
            //@ts-ignore
            content: content
        }
    }
}

export const convertMessagesToAnthropicMessages = (messages: BaseChatMessageLike[]): Anthropic.Messages.MessageParam[] => {
    return messages.map((message) => convertMessageToAnthropicMessage(message))
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

