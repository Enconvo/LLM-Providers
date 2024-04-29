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
        // try {
        // const chat = (runnable as BaseChatModel)
        // console.log("chat_cache")
        // const cache = await LocalFileCache.create(path.join(environment.cachePath, "chat"));
        // chat.cache = cache
        // } catch (error) {

        // }
        return runnable
    }

    bind(bindings: Bindings): LLMProviderBase {
        this.bindings = bindings

        this.tools = bindings.tools || []

        return this
    }

    async call({ messages }: { messages: BaseMessage[] }): Promise<LLMResult> {
        console.log("call", this.options.model || this.options.modelName)
        const llmOptions = this.options


        if (this.autoInit && !this.lcChatModel) {
            this.lcChatModel = await this.initLCChatModel(this.options)
        }

        if (this.lcChatModel) {
            //@ts-ignore

            if (!isSupportSystemMessage(llmOptions)) {
                const systemMsg = messages.find((message) => {
                    return message._getType() === 'system'
                })
                if (systemMsg) {
                    messages = messages.filter((message) => {
                        return message._getType() !== 'system'
                    })

                    console.log("lcChatModel", isSupportSystemMessage(llmOptions), systemMsg, messages)

                    if (isSupportSystemPrompt(llmOptions)) {
                        //@ts-ignore
                        this.lcChatModel.system_prompt = systemMsg.content
                    } else {
                        if (systemMsg.content) {
                            const firstMessage = new HumanMessage(systemMsg.content as string)
                            // add to first
                            messages = [firstMessage, ...messages]
                        }
                    }
                }
            }

            for (let key in this.bindings) {
                const value = this.bindings[key]
                // 如果是数组
                console.log("key", key, value)
                if (Array.isArray(value) && value.length <= 0) {
                    delete this.bindings[key]
                }
            }

            this.lcChatModel = this.lcChatModel?.bind(this.bindings)
        }
        return await this._call({ messages })
    }
}



export const isSupportSystemMessage = (llmOptions: any) => {
    if (llmOptions.commandName === 'premai' || llmOptions.originCommandName === 'premai' || llmOptions.commandName === "chat_cohere" || llmOptions.originCommandName === "chat_cohere") {
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
