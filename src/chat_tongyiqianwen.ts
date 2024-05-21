import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";
import { ChatAlibabaTongyi } from "./llm/alibaba_tongyi.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        options.temperature = Number(options.temperature.value);

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName;


        const model = new ChatAlibabaTongyi({
            streaming: true,
            ...options
        });

        return model;
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}