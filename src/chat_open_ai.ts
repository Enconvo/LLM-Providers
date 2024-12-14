import { env } from 'process';
import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, UserMessage } from '@enconvo/api';
import { convertMessagesToOpenAIMessages } from './utils/openai_util.ts';
import OpenAI from 'openai';
import { wrapOpenAI } from "langsmith/wrappers";
import { streamFromOpenAI } from './utils/stream_utils.ts';



export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}



class ChatOpenAIProvider extends LLMProvider {
    client: OpenAI
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.client = this._createOpenaiClient(this.options)
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


    private _createOpenaiClient(options: LLMProvider.LLMOptions): OpenAI {
        // change options.temperature to number
        options.temperature = Number(options.temperature.value);

        // streaming to boolean


        let headers = {
        }

        if (options.originCommandName === 'enconvo_ai') {
            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`
            }
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
            defaultHeaders: headers,
        });


        return wrapOpenAI(client)
    }
}








