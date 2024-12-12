import { BaseMessage, BaseMessageChunk, HumanMessage, SystemMessage } from "langchain/schema";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { Runnable } from "@langchain/core/runnables";
import { StructuredToolInterface } from "@langchain/core/tools";

export interface LLMResult {
    stream: IterableReadableStream<BaseMessageChunk> | undefined
}

export type LLMOptions = {
    [key: string]: any;
};

type Bindings = { tools?: StructuredToolInterface[], [key: string]: any }

export abstract class LLMProviderBase {
    protected options: LLMOptions;
    protected tools: StructuredToolInterface[] = [];
    protected bindings: Bindings = {}
    protected autoInit?: boolean = true;
    protected lcChatModel?: Runnable

    getLCModel() {
        return this.lcChatModel
    }

    constructor(fields: { options: LLMOptions, autoInit?: boolean }) {
        this.options = fields.options
        this.autoInit = fields.autoInit === undefined ? true : fields.autoInit
    }

    protected abstract _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult>;

    protected abstract _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined>

    async initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        const runnable = await this._initLCChatModel(options)
        this.lcChatModel = runnable
        return runnable
    }

    bind(bindings: Bindings): LLMProviderBase {
        this.bindings = bindings

        this.tools = bindings.tools || []

        return this
    }

    async call({ messages }: { messages: BaseMessage[] }): Promise<LLMResult> {
        const llmOptions = this.options


        if (this.autoInit && !this.lcChatModel) {
            this.lcChatModel = await this.initLCChatModel(JSON.parse(JSON.stringify(this.options)))
        }

        // console.log("call113--", this.options.model || this.options.modelName, this.lcChatModel)
        //@ts-ignore
        // console.log("call22--", this.options.model || this.options.modelName)
        if (!isSupportSystemMessage(llmOptions)) {
            const systemMsg = messages.find((message) => {
                return message._getType() === 'system'
            })
            if (systemMsg) {
                messages = messages.filter((message) => {
                    return message._getType() !== 'system'
                })


                if (isSupportSystemPrompt(llmOptions)) {
                    if (this.lcChatModel) {
                        //@ts-ignore
                        this.lcChatModel.system_prompt = systemMsg.content
                    }
                } else {
                    if (systemMsg.content && isSupportMultiUserMessage(llmOptions)) {
                        const firstMessage = new HumanMessage(systemMsg.content as string)
                        // add to first
                        messages = [firstMessage, ...messages]
                    } else {
                        //保留最后一条消息
                        messages = [messages[messages.length - 1]]
                    }
                }
            }

            for (let key in this.bindings) {
                const value = this.bindings[key]
                // 如果是数组
                // console.log("key", key, value)
                if (Array.isArray(value) && value.length <= 0) {
                    delete this.bindings[key]
                }
            }

            // console.log("bindings", this.bindings)
            this.lcChatModel = this.lcChatModel?.bind(this.bindings)
        }
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
