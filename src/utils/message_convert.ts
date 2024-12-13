import { BaseChatMessage, BaseChatMessageChunk, Stream } from "@enconvo/api"
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import OpenAI from "openai"

export const convertMessageToLangchainMessage = (message: BaseChatMessage): BaseMessage => {
    switch (message.role) {
        case "system":
            return new SystemMessage({
                content: message.content
            })
        case "user":
            return new HumanMessage({
                content: message.content
            })
        case "assistant":
            return new AIMessage({ content: message.content })
        default:
            throw new Error(`Unknown message role: ${message.role}`)
    }
}

export const convertMessagesToLangchainMessages = (messages: BaseChatMessage[]): BaseMessage[] => {
    return messages.map((message) => convertMessageToLangchainMessage(message))
}



export const convertMessageToOpenAIMessage = (message: BaseChatMessage): OpenAI.Chat.ChatCompletionMessageParam => {

    if (typeof message.content === "string") {
        //@ts-ignore
        return {
            role: message.role,
            content: message.content
        }
    } else {
        return {
            role: message.role,
            //@ts-ignore
            content: message.content
        }
    }


}

export const convertMessagesToOpenAIMessages = (messages: BaseChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] => {
    return messages.map((message) => convertMessageToOpenAIMessage(message))
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