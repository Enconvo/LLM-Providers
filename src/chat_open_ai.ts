import { ChatOpenAI } from '@langchain/openai'
import { LLMOptions, LLMProviderBase, LLMResult } from './llm_provider.ts';
import { BaseMessage } from 'langchain/schema';
import { Runnable } from 'langchain/runnables';
import { env } from 'process';

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

            const modelName = modelOptions.value

            if (options.originCommandName === 'azure_openai') {
                options.azureOpenAIApiDeploymentName = modelName;
                delete options.modelName;
            } else {
                options.modelName = modelName;
            }
        }



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
                ...customHeaders,
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`
            },
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

