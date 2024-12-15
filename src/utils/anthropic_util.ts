import Anthropic from "@anthropic-ai/sdk"
import { BaseChatMessage, BaseChatMessageChunk, FileUtil, Stream } from "@enconvo/api"

export const convertMessageToAnthropicMessage = (message: BaseChatMessage): Anthropic.Messages.MessageParam => {

    if (typeof message.content === "string") {
        return {
            //@ts-ignore
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
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": `image/${mimeType}`,
                            "data": base64
                        }
                    }
                }
            }
            return item
        })

        return {
            //@ts-ignore
            role: message.role,
            //@ts-ignore
            content: content
        }
    }


}

export const convertMessagesToAnthropicMessages = (messages: BaseChatMessage[]): Anthropic.Messages.MessageParam[] => {
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
            for await (const chunk of response) {
                if (done) continue;

                if (chunk.type === "message_stop") {
                    done = true;
                    continue
                }

                if (chunk.type === "content_block_delta") {
                    if (chunk.delta.type === "text_delta") {
                        const newChunk = new BaseChatMessageChunk({
                            content: chunk.delta.text,
                        })
                        yield newChunk
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