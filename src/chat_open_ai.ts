import { env } from 'process';
import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, UserMessage } from '@enconvo/api';
import OpenAI from 'openai';
import { wrapOpenAI } from "langsmith/wrappers";
import { OpenAIUtil } from './utils/openai_util.ts';


export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}


export class ChatOpenAIProvider extends LLMProvider {

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const params = this.initParams(content)
        const chatCompletion = await this.client.chat.completions.create({
            ...params,
            stream: true,

        });

        const ac = new AbortController()
        //@ts-ignore
        const stream = OpenAIUtil.streamFromOpenAI(chatCompletion, ac)
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
            ...params,
        });

        const result = chatCompletion.choices[0]

        return new UserMessage(result?.message?.content || '')
    }

    private initParams(content: LLMProvider.Params) {
        console.log("openai content", JSON.stringify(this.options, null, 2))
        const credentials = this.options.credentials
        if (!credentials.apiKey) {
            throw new Error("API key is required")
        }
        const modelOptions = this.options.modelName

        const messages = OpenAIUtil.convertMessagesToOpenAIMessages(this.options, content.messages)

        const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools)

        let reasoning_effort = this.options?.reasoning_effort?.value === "off" ? null : this.options?.reasoning_effort?.value

        if (!modelOptions?.title?.toLowerCase().includes("r1")) {
            reasoning_effort = null
        }

        let temperature = this.options.temperature.value
        try {
            temperature = typeof temperature === "string" ? parseFloat(temperature) : temperature
        } catch (e) {
            temperature = 0.5
        }
        if (modelOptions?.value.includes('gpt-5')) {
            temperature = 1
        }

        let params: any = {
            model: modelOptions?.value,
            temperature: temperature,
            messages
        }

        if (reasoning_effort) {
            params.reasoning_effort = reasoning_effort
        }

        if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
            params = {
                ...params,
                tools,
                tool_choice: content.tool_choice,
                parallel_tool_calls: modelOptions?.toolUse === true ? false : null,
            }
        }


        return params
    }

    private _createOpenaiClient(options: LLMProvider.LLMOptions): OpenAI {

        let headers = {}

        if (options.originCommandName === 'enconvo_ai') {
            // Encode commandTitle to handle special characters in HTTP headers

            headers = {
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`,
                "commandTitle": `${env['commandTitle']}`,
                "modelName": options.modelName.value
            }
        } else if (options.originCommandName === 'chat_openrouter') {
            headers = {
                'HTTP-Referer': 'https://enconvo.ai',
                'X-Title': 'Enconvo',
            }
        }
        // console.log("headers", headers)

        if (
            options.modelName &&
            (options.modelName.value === "openai/o1-mini"
                || options.modelName.value === "openai/o1-preview"
                || options.modelName.value === "o1-mini"
                || options.modelName.value === "o1-preview")
        ) {
            options.max_completion_tokens = options.maxTokens;
            delete options.maxTokens;
        }


        if (options.baseUrl === 'http://127.0.0.1:5001') {
            options.frequencyPenalty = 0.0001
        }
        const credentials = options.credentials

        const client = new OpenAI({
            apiKey: credentials?.apiKey, // This is the default and can be omitted
            // baseURL: "http://127.0.0.1:8181/v1",
            baseURL: credentials?.baseUrl || "https://api.openai.com/v1",
            defaultHeaders: headers,

        });

        if (env['LANGCHAIN_TRACING_V2'] === 'true') {
            return wrapOpenAI(client)
        }

        return client
    }
}








