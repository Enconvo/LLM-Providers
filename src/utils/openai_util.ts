import { BaseChatMessage, BaseChatMessageChunk, FileUtil, LLMProvider, Stream } from "@enconvo/api"
import OpenAI from "openai"



export namespace OpenAIUtil {
    export const convertMessageToOpenAIMessage = (options: LLMProvider.LLMOptions, message: BaseChatMessage): OpenAI.Chat.ChatCompletionMessageParam => {
        let role = message.role
        if (options.modelName.systemMessageEnable === false && message.role === "system") {
            role = "user"
        }

        if (typeof message.content === "string") {
            //@ts-ignore
            return {
                role: role,
                content: message.content
            }
        } else {

            const content = message.content.filter((item) => {
                if (options.modelName.visionEnable === true) {
                    return item.type === "text" || item.type === "image_url"
                }

                return item.type === "text"

            }).map((item) => {
                if (item.type === "image_url") {
                    const url = item.image_url.url
                    if (url.startsWith("file://")) {
                        const base64 = FileUtil.convertFileUrlToBase64(url)
                        const mimeType = url.split(".").pop()
                        return {
                            type: "image_url",
                            image_url: {
                                url: `data:image/${mimeType};base64,${base64}`
                            }
                        }
                    }
                }
                return item
            })


            if (message.content.length === 1 && message.content[0].type === "text") {
                //@ts-ignore
                return {
                    role: role,
                    content: message.content[0].text
                }
            }



            return {
                role: role,
                //@ts-ignore
                content: content
            }
        }
    }


    export const convertMessagesToOpenAIMessages = (options: LLMProvider.LLMOptions, messages: BaseChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] => {

        if (options.modelName.visionImageCountLimit !== undefined && options.modelName.visionImageCountLimit > 0 && options.modelName.visionEnable === true) {
            if (options.modelName.visionImageCountLimit !== undefined && options.modelName.visionEnable === true) {
                const countLimit = options.modelName.visionImageCountLimit;
                let imageCount = 0;

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

        let newMessages = messages.map((message) => convertMessageToOpenAIMessage(options, message)).filter((message) => {
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

                    if (chunk.choices[0].finish_reason) {
                        done = true;
                        continue
                    }

                    const newChunk = new BaseChatMessageChunk({
                        content: chunk.choices[0].delta.content || '',
                        id: chunk.id
                    })

                    yield newChunk
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
}