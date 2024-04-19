import { BaseMessage, BaseMessageChunk } from "langchain/schema";
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
        return this._initLCChatModel(options)
    }

    bind(bindings: Bindings): LLMProviderBase {
        this.bindings = bindings

        this.tools = bindings.tools || []

        return this
    }

    async call({ messages }: { messages: BaseMessage[] }): Promise<LLMResult> {
        if (this.autoInit && !this.lcChatModel) {
            this.lcChatModel = await this.initLCChatModel(this.options)
        }

        if (this.lcChatModel) {
            //@ts-ignore

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

