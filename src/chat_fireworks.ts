import { LLMOptions, LLMProviderBase, LLMResult } from './llm_provider.ts';
import { BaseMessage } from 'langchain/schema';
import { Runnable } from 'langchain/runnables';
import { env } from 'process';
import { ChatFireworks } from "@langchain/community/chat_models/fireworks";

export default function main(options: any) {
    return new ChatOpenAIProvider({ options })
}

class ChatOpenAIProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable> {

        // change options.temperature to number
        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

        const modelOptions = options.modelName

        if (modelOptions) {

            options.maxTokens = modelOptions.maxTokens || 4096;

            const modelName = modelOptions.value || modelOptions;
            options.modelName = modelName;
        }


        return new ChatFireworks({
            modelName: options.modelName,
            apiKey: options.openAIApiKey
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

