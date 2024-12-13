import { ChatPrem } from "@langchain/community/chat_models/premai";
import { BaseMessage } from "langchain/schema";
import { LLMProvider, LLMOptions, LLMResult } from "./llm_provider.ts";
import { Runnable } from "@langchain/core/runnables";


export default function main(options: any) {
    return new PremAIProvider({ options })
}

class PremAIProvider extends LLMProvider {
    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }


    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        options.temperature = Number(options.temperature.value);

        const modelOptions = options.model
        const modelName = modelOptions.value
        options.model = modelName;


        const model = new ChatPrem({
            ...options,
        });

        return model;
    }
}