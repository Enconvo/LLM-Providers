import { LLMProvider } from './llm_provider.ts';
import { env } from 'process';
import { BaseChatMessage, BaseChatMessageChunk, Stream, UserMessage } from '@enconvo/api';
import { convertMessagesToOpenAIMessages, streamFromOpenAI } from './utils/message_convert.ts';
import OpenAI from 'openai';


export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}



class ChatOpenAIProvider extends LLMProvider {
    client: OpenAI
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.client = this._initLangchainChatModel(this.options)
    }

    protected async _stream(content: { messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {
        const modelOptions = this.options.modelName

        if (modelOptions) {

            if (this.options.originCommandName !== 'chat_sambanova') {
                this.options.maxTokens = modelOptions.maxTokens || 4096;
            } else {
                delete this.options.maxTokens;
            }

            const modelName = modelOptions.value || modelOptions;

            if (this.options.originCommandName === 'azure_openai') {
                this.options.azureOpenAIApiDeploymentName = modelName;
                delete this.options.modelName;
            } else {
                this.options.modelName = modelName;
            }
        }

        const chatCompletion = await this.client.chat.completions.create({
            messages: convertMessagesToOpenAIMessages(content.messages),
            model: this.options.modelName,
            stream: true
        });

        return streamFromOpenAI(chatCompletion, chatCompletion.controller)
    }


    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {

        const modelOptions = this.options.modelName

        if (modelOptions) {

            if (this.options.originCommandName !== 'chat_sambanova') {
                this.options.maxTokens = modelOptions.maxTokens || 4096;
            } else {
                delete this.options.maxTokens;
            }

            const modelName = modelOptions.value || modelOptions;

            if (this.options.originCommandName === 'azure_openai') {
                this.options.azureOpenAIApiDeploymentName = modelName;
                delete this.options.modelName;
            } else {
                this.options.modelName = modelName;
            }
        }

        const chatCompletion = await this.client.chat.completions.create({
            messages: convertMessagesToOpenAIMessages(content.messages),
            model: this.options.modelName
        });

        const result = chatCompletion.choices[0]

        return new UserMessage(result?.message?.content || '')
    }


    private _initLangchainChatModel(options: LLMProvider.LLMOptions): OpenAI {
        // change options.temperature to number
        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

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
            delete options.streaming;
        }


        if (options.baseUrl === 'http://127.0.0.1:5001') {
            options.frequencyPenalty = 0.0001
        }


        const client = new OpenAI({
            apiKey: options.openAIApiKey, // This is the default and can be omitted
            baseURL: options.baseUrl || "https://api.openai.com/v1",
        });


        return client
    }
}








