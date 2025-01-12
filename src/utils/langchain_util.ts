import { BaseChatMessage, BaseChatMessageChunk, FileUtil, Stream, uuid } from "@enconvo/api"
import { AIMessageChunk, BaseMessageLike } from "@langchain/core/messages"

export namespace LangchainUtil {


    export const convertMessageToLangchainMessage = (message: BaseChatMessage): BaseMessageLike => {

        if (typeof message.content === "string") {
            //@ts-ignore
            return {
                role: message.role,
                content: message.content
            }
        } else {

            const content = message.content.filter((item) => item.type === "text" || item.type === "image_url").map((item) => {
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

            return {
                role: message.role,
                content: content
            }
        }
    }

    export const convertMessagesToLangchainMessages = (messages: BaseChatMessage[]): BaseMessageLike[] => {
        return messages.map((message) => convertMessageToLangchainMessage(message))
    }


    export function streamFromLangchain(response: AsyncIterable<AIMessageChunk>, controller: AbortController): Stream<BaseChatMessageChunk> {
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
                    if (typeof chunk.content === "string") {

                        const newChunk: BaseChatMessageChunk = {
                            model: "Langchain",
                            id: chunk.id || uuid(),
                            choices: [{
                                delta: {
                                    content: chunk.content,
                                    role: "assistant"
                                },
                                finish_reason: null,
                                index: 0
                            }],
                            created: Date.now(),
                            object: "chat.completion.chunk"
                        }

                        yield newChunk
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


}