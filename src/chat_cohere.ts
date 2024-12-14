import { LLMProvider } from "@enconvo/api";
import { ChatCohere } from "@langchain/cohere";
import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";



export default function main(options: any) {
    return new CohereAIProvider({ options })
}

export class CohereAIProvider extends LLMProvider {
    protected async _initLCChatModel(options: LLMProvider.LLMOptions): Promise<Runnable | undefined> {

        options.temperature = Number(options.temperature.value);

        const modelOptions = options.model
        const modelName = modelOptions.value
        options.model = modelName;

        const model = new ChatCohere({
            ...options
        })

        return model
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}