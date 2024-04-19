import { ChatOpenAI } from "langchain/chat_models/openai";

import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        // change options.temperature to number
        options.temperature = Number(options.temperature.value);


        let config: any = {
            baseURL: options.baseUrl,
            defaultHeaders: options.headers
        }

        return new ChatOpenAI({
            openAIApiKey: 'sk-1234567890',
            ...options,
            configuration: config
        },
        );
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}

