import { BaseChatMessage, BaseChatMessageChunk, UserMessage, Stream } from "@enconvo/api";


export type LLMOptions = {
    [key: string]: any;
};

export abstract class LLMProvider {
    protected options: LLMOptions;

    constructor(options: LLMOptions) {
        this.options = options
    }

    protected abstract _call(content: { messages: BaseChatMessage[] }): Promise<BaseChatMessage>;

    protected abstract _stream(content: { messages: BaseChatMessage[] }): Promise<Stream<BaseChatMessageChunk>>;


    async stream(content: string | BaseChatMessage[] | { content: string; messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {
        let messages: BaseChatMessage[];
        if (typeof content === 'string') {
            messages = [new UserMessage(content)];
        } else if (Array.isArray(content)) {
            messages = content;
        } else {
            messages = content.messages;
            if (content.content) {
                messages.push(new UserMessage(content.content));
            }
        }
        return this._stream({ messages });
    }


    async call(content: string | BaseChatMessage[] | { content: string; messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {
        let messages: BaseChatMessage[];
        if (typeof content === 'string') {
            messages = [new UserMessage(content)];
        } else if (Array.isArray(content)) {
            messages = content;
        } else {
            messages = content.messages;
            if (content.content) {
                messages.push(new UserMessage(content.content));
            }
        }

        // if (!isSupportSystemMessage(llmOptions)) {
        //     const systemMsg = messages.find((message) => {
        //         return message._getType() === 'system'
        //     })
        //     if (systemMsg) {
        //         messages = messages.filter((message) => {
        //             return message._getType() !== 'system'
        //         })


        //         if (isSupportSystemPrompt(llmOptions)) {
        //             if (this.lcChatModel) {
        //                 //@ts-ignore
        //                 this.lcChatModel.system_prompt = systemMsg.content
        //             }
        //         } else {
        //             if (systemMsg.content && isSupportMultiUserMessage(llmOptions)) {
        //                 const firstMessage = new UserMessage(systemMsg.content as string)
        //                 // add to first
        //                 messages = [firstMessage, ...messages]
        //             } else {
        //                 //保留最后一条消息
        //                 messages = [messages[messages.length - 1]]
        //             }
        //         }
        //     }

        //     for (let key in this.bindings) {
        //         const value = this.bindings[key]
        //         // 如果是数组
        //         // console.log("key", key, value)
        //         if (Array.isArray(value) && value.length <= 0) {
        //             delete this.bindings[key]
        //         }
        //     }

        //     // console.log("bindings", this.bindings)
        //     this.lcChatModel = this.lcChatModel?.bind(this.bindings)
        // }
        return await this._call({ messages })
    }
}


export const isOpenAIO1Model = (modelName: string) => {
    const isOpenAIO1Model = modelName === "openai/o1-mini"
        || modelName === "openai/o1-preview"
        || modelName === "o1-mini"
        || modelName === "o1-preview"
    return isOpenAIO1Model
}

export const isSupportSystemMessage = (llmOptions: any) => {
    // console.log("llmOptions", llmOptions)

    const isPremAI = llmOptions.commandName === 'premai' || llmOptions.originCommandName === 'premai'
    const isCohere = llmOptions.commandName === "chat_cohere" || llmOptions.originCommandName === "chat_cohere"

    const modelName: string = llmOptions?.modelName?.value || llmOptions?.model?.value || ''

    const isYi = llmOptions.commandName === "chat_yii" || llmOptions.originCommandName === "chat_yii"
    const isYiVisionModel = modelName === 'yi-vl-plus'

    const isGroq = llmOptions.commandName === "chat_groq" || llmOptions.originCommandName === "chat_groq"
    const isGroqVisionModel = modelName === 'llava-v1.5-7b-4096-preview' || modelName === 'llama-3.2-11b-vision-preview'


    if (isPremAI || isCohere || (isYi && isYiVisionModel) || (isGroq && isGroqVisionModel) || isOpenAIO1Model(modelName)) {
        return false
    }

    return true
}

export const isSupportSystemPrompt = (llmOptions: any) => {
    if (llmOptions.commandName === 'premai' || llmOptions.originCommandName === 'premai') {
        return true
    }
    return false
}

export const isSupportMultiUserMessage = (llmOptions: any) => {
    const isGroq = llmOptions.commandName === "chat_groq" || llmOptions.originCommandName === "chat_groq"
    const isGroqVisionModel = llmOptions?.modelName?.value === 'llava-v1.5-7b-4096-preview'

    if (isGroq && isGroqVisionModel) {
        return false
    }

    return true
}
