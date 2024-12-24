import { env } from 'process';
import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, UserMessage } from '@enconvo/api';
import OpenAI from 'openai';
import { wrapOpenAI } from "langsmith/wrappers";
import { OpenAIUtil } from './utils/openai_util.ts';
import fs from 'fs';
import { homedir } from 'os';


export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}


class ChatOpenAIProvider extends LLMProvider {

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        console.log("content", content)
        const params = this.initParams(content)

        const chatCompletion = await this.client.chat.completions.create({
            ...params,
            stream: true,
        });

        const stream = OpenAIUtil.streamFromOpenAI(chatCompletion, chatCompletion.controller)
        return stream

    }


    client: OpenAI
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.client = this._createOpenaiClient(this.options)
    }



    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {
        const params = this.initParams(content)

        const chatCompletion = await this.client.chat.completions.create({
            ...params
        });

        const result = chatCompletion.choices[0]

        return new UserMessage(result?.message?.content || '')
    }

    private initParams(content: LLMProvider.Params) {
        const modelOptions = this.options.modelName

        const messages = OpenAIUtil.convertMessagesToOpenAIMessages(this.options, content.messages)
        const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools)

        let params = {
            model: modelOptions.value,
            temperature: this.options.temperature.value,
            messages,
            tools,
            tool_choice: content.tool_choice
        }

        return params
    }

    private _createOpenaiClient(options: LLMProvider.LLMOptions): OpenAI {


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
            options.modelName.value === "openai/o1-mini"
            || options.modelName.value === "openai/o1-preview"
            || options.modelName.value === "o1-mini"
            || options.modelName.value === "o1-preview"
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








