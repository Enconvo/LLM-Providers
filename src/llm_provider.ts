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


export abstract class LLMProviderBase {
    protected options: LLMOptions;
    protected tools: StructuredToolInterface[] = [];
    protected autoInit?: boolean = true;
    protected lcChatModel?: Runnable

    getLCModel() {
        return this.lcChatModel
    }

    constructor(fields: { options: LLMOptions, autoInit?: boolean }) {
        this.options = fields.options
        this.autoInit = fields.autoInit
    }


    protected abstract _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult>;
    protected abstract _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined>
    async initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        return this._initLCChatModel(options)
    }

    bind({ tools }: { tools: StructuredToolInterface[] }): LLMProviderBase {
        this.tools = tools
        return this
    }

    async call({ messages }: { messages: BaseMessage[] }): Promise<LLMResult> {
        if (this.autoInit && !this.lcChatModel) {
            this.lcChatModel = await this.initLCChatModel(this.options)
        }

        if (this.lcChatModel && this.tools.length > 0) {

            this.lcChatModel = this.lcChatModel?.bind({
                //@ts-ignore
                tools: this.tools,
            })
        }
        return await this._call({ messages })
    }
}

