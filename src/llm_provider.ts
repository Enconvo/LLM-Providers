import { BaseMessage, BaseMessageChunk } from "langchain/schema";
import { BaseChatModel } from "langchain/chat_models/base";
import { IterableReadableStream } from "@langchain/core/utils/stream";

export interface LLMResult {
    stream: IterableReadableStream<BaseMessageChunk> | undefined
}

export type LLMOptions = {
    voice: string;
    format?: string;
    [key: string]: any;
};


export abstract class LLMProviderBase {
    protected options: LLMOptions;
    protected lcChatModel: BaseChatModel | undefined

    constructor(fields: { options: LLMOptions }) {
        this.options = fields.options
        this.lcChatModel = this._initLCChatModel(this.options)
    }

    protected abstract _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult>;
    protected abstract _initLCChatModel(options: LLMOptions): BaseChatModel | undefined

    async call({ messages }: { messages: BaseMessage[] }): Promise<LLMResult> {

        return await this._call({ messages })
    }
}

