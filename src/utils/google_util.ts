import Google from "@google/generative-ai"
import { BaseChatMessage, BaseChatMessageChunk, FileUtil, Stream } from "@enconvo/api"


function convertRole(role: BaseChatMessage["role"]) {
    if (role === "user") {
        return "user"
    } else if (role === "assistant") {
        return "model"
    }
    return "user"
}


export const convertMessageToGoogleMessage = (message: BaseChatMessage): Google.Content => {

    if (typeof message.content === "string") {
        return {
            role: convertRole(message.role),
            parts: [{
                text: message.content
            }]
        }
    } else {
        const content = message.content.filter((item) => item.type === "text" || item.type === "image_url").map((item) => {
            if (item.type === "image_url") {
                const url = item.image_url.url
                if (url.startsWith("file://")) {
                    const base64 = FileUtil.convertFileUrlToBase64(url)
                    const mimeType = url.split(".").pop()
                    return {
                        inlineData: {
                            data: base64,
                            mimeType: `image/${mimeType}`
                        },
                    }
                }
            } else if (item.type === "text") {
                return {
                    "text": item.text
                }
            }
            return item
        })

        return {
            role: convertRole(message.role),
            //@ts-ignore
            parts: content
        }
    }
}

export const convertMessagesToGoogleMessages = (messages: BaseChatMessage[]): Google.Content[] => {
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
                // console.log("chunk", chunk)
                if (done) continue;
                if (chunk.candidates?.[0]?.finishReason === "STOP") {
                    done = true;
                }

                const newChunk = new BaseChatMessageChunk({
                    content: chunk.text(),
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
