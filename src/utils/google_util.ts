import Google, { FunctionDeclaration, FunctionDeclarationsTool } from "@google/generative-ai"
import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, FileUtil, LLMTool, Stream, ToolMessage, uuid } from "@enconvo/api"


export namespace GoogleUtil {

    export const convertToolsToGoogleTools = (tools?: LLMTool[]): FunctionDeclarationsTool[] | undefined => {
        if (!tools) {
            return undefined
        }


        let functionDeclarations: FunctionDeclaration[] | undefined = tools?.map((tool) => {

            Object.entries(tool.parameters.properties).forEach(([key, value]: [string, any]) => {
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

            if(Object.keys(tool.parameters.properties).length === 0){
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



export const convertMessageToGoogleMessage = (message: BaseChatMessageLike): Google.Content => {

    if (message.role === "tool") {
        const toolMessage = message as ToolMessage
        return {
            role: "function",
            parts: [
                {
                    functionResponse: {
                        name: toolMessage.tool_name,
                        response: JSON.parse(toolMessage.content as string)
                    }
                }
            ]
        }
    }

    if (message.role === "assistant") {
        const aiMessage = message as AssistantMessage
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {

            let args = JSON.parse(aiMessage.tool_calls[0].function.arguments)
            return {
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
        }
    }




    if (typeof message.content === "string") {
        return {
            role: convertRole(message.role),
            parts: [{
                text: message.content
            }]
        }
    } else {
        const content: Google.Part[] = message.content.filter((item) => {
            let filter = item.type === "text" || item.type === "flow_step" || item.type === "image_url"
            return filter
        }).map((item) => {
            if (item.type === "image_url") {
                const url = item.image_url.url
                if (message.role === "user" && url.startsWith("file://")) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = url.split(".").pop()
                    return {
                        inlineData: {
                            data: base64,
                            mimeType: `image/${mimeType}`
                        },
                    }
                } else {

                    return {
                        text: "type:image_url , url:" + url
                    }
                }
            } else if (item.type === "flow_step") {
                return {
                    text: `type:tool_use, \n tool_name: ${item.title}\ntool_params: ${item.flowParams}\ntool_result: ${JSON.stringify(item.flowResults)}`
                }
            } else if (item.type === "text") {
                return {
                    text: item.text
                }
            }

            return {
                text: ""
            }
        })


        return {
            role: convertRole(message.role),
            //@ts-ignore
            parts: content
        }
    }
}

export const convertMessagesToGoogleMessages = (messages: BaseChatMessageLike[]): Google.Content[] => {
    return messages.map((message) => convertMessageToGoogleMessage(message))
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
                console.log("google chunk", JSON.stringify(chunk, null, 2))
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
