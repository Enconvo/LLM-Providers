import { BaseChatMessageChunk, Stream } from "@enconvo/api";
import OpenAI from "openai";

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
