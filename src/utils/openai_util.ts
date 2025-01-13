import { AssistantMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMProvider, LLMTool, Stream } from "@enconvo/api"
import OpenAI from "openai"



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

            const content: OpenAI.Chat.ChatCompletionMessageParam[][] = message.content.filter((item) => {
                let filter = item.type === "text" || item.type === "flow_step"
                if (options.modelName.visionEnable === true) {
                    filter = filter || item.type === "image_url"
                }
                return filter
            }).map((item) => {
                let role = message.role as 'user' | 'assistant'
                if (item.type === "image_url") {
                    const url = item.image_url.url
                    if (role === "user" && url.startsWith("file://")) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        const mimeType = url.split(".").pop()
                        return [{
                            role: role,
                            content: [{
                                type: "image_url",
                                image_url: {
                                    url: `data:image/${mimeType};base64,${base64}`
                                }
                            }]
                        }]
                    } else {
                        return [{
                            role: role,
                            content: [{
                                type: "text",
                                text: "type:image_url , url:" + url
                            }]
                        }]
                    }
                } else if (item.type === "flow_step") {

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
                            content: JSON.stringify(item.flowResults)
                        }]

                    return msgs

                } else if (item.type === "text") {
                    return [{
                        role: role,
                        content: item.text
                    }]
                }

                return [{
                    role: role,
                    content: ""
                }]
            })




            return content.flat()
        }
    }


    export const convertToolsToOpenAITools = (tools?: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] | undefined => {
        if (!tools) {
            return undefined
        }

        let newTools: OpenAI.Chat.ChatCompletionTool[] | undefined = tools?.map((tool) => {

            const requestedParameters = tool.parameters ? Object.entries(tool.parameters).reduce((acc, [key, value]) => {
                if (value.required === true) {
                    delete value.required
                    acc.push(key);
                }
                return acc;
            }, [] as string[]) : []


            return {
                type: "function",
                function: {
                    name: tool.id.replace("|", "-"),
                    description: tool.description,
                    parameters: {
                        type: "object",
                        properties: tool.parameters,
                        required: requestedParameters
                    },
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
        })


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