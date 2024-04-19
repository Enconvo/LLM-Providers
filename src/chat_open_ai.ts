import { ChatOpenAI } from '@langchain/openai'
import { LLMOptions, LLMProviderBase, LLMResult } from './llm_provider.ts';
import { BaseMessage } from 'langchain/schema';
import { Runnable } from 'langchain/runnables';

export default function main(options: any) {
    return new ChatOpenAIProvider({ options })
}

class ChatOpenAIProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable> {

        // change options.temperature to number
        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

        const modelOptions = options.modelName

        const modelName = modelOptions.value

        options.modelName = modelName;
        options.maxTokens = 4096;

        // streaming to boolean
        let customHeaders = {}
        try {
            customHeaders = JSON.parse(options.customHeaders)
        } catch (error) {

        }

        let config: any = {
            baseURL: options.baseUrl,
            defaultHeaders: {
                ...options.headers,
                ...customHeaders
            }
        }

        return new ChatOpenAI({
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

