import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";

import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName;

        const model = new ChatCloudflareWorkersAI({
            model: options.modelName, // Default value
            cloudflareAccountId: options.account_id,
            cloudflareApiToken: options.apiKey,
            ...options,
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
