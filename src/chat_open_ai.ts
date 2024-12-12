import { ChatOpenAI } from '@langchain/openai'
import { LLMOptions, LLMProviderBase, LLMResult } from './llm_provider.ts';
import { BaseMessage } from 'langchain/schema';
import { env } from 'process';
import { Runnable } from '@langchain/core/runnables';

export default function main(options: any) {
    return new ChatOpenAIProvider({ options })
}

class ChatOpenAIProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        // change options.temperature to number
        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

        const modelOptions = options.modelName

        if (modelOptions) {

            if (options.originCommandName !== 'chat_sambanova') {
                options.maxTokens = modelOptions.maxTokens || 4096;
            } else {
                delete options.maxTokens;
            }

            const modelName = modelOptions.value || modelOptions;

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


        let headers = {
            ...options.headers,
            ...customHeaders
        }

        if (options.originCommandName === 'enconvo_ai') {
            headers = {
                ...headers,
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`
            }
        }

        let config: any = {
            baseURL: options.baseUrl || "https://api.openai.com/v1",
            defaultHeaders: headers,
        }

        if (
            options.modelName === "openai/o1-mini"
            || options.modelName === "openai/o1-preview"
            || options.modelName === "o1-mini"
            || options.modelName === "o1-preview"
        ) {
            options.max_completion_tokens = options.maxTokens;
            delete options.maxTokens;
        }

        delete options.streaming;

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

