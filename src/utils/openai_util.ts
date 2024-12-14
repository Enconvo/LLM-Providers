import { BaseChatMessage, BaseChatMessageChunk, FileUtil, Stream } from "@enconvo/api"
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
            //@ts-ignore
            content: content
        }
    }


}

export const convertMessagesToOpenAIMessages = (messages: BaseChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] => {
    return messages.map((message) => convertMessageToOpenAIMessage(message))
}


