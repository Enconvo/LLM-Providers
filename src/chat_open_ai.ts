import { env } from 'process';
import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, res, Stream, UserMessage } from '@enconvo/api';
import OpenAI from 'openai';
import { wrapOpenAI } from "langsmith/wrappers";
import { OpenAIUtil } from './utils/openai_util.ts';
import { codex_instructions } from './utils/instructions.ts';


export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}


export class ChatOpenAIProvider extends LLMProvider {

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        if (this.options.credentials?.credentials_type?.value === 'oauth2') {
            console.log("_stream_v2")
            return await this._stream_v2(content)
        }
        const params = await this.initParams(content)
        let chatCompletion: any
        chatCompletion = await this.client.chat.completions.create({
            ...params,
            stream: true,
        });

        const ac = new AbortController()
        //@ts-ignore
        const stream = OpenAIUtil.streamFromOpenAI(chatCompletion, ac)
        return stream
    }

    protected async _stream_v2(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const params = await this.initResponseParams(content)
        const response = await this.client.responses.create(params);

        const ac = new AbortController()
        //@ts-ignore
        const stream = OpenAIUtil.streamFromOpenAIResponse(response, ac)
        return stream
    }

    client: OpenAI
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.client = this._createOpenaiClient(this.options)
    }

    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {
        const params = await this.initParams(content)

        const chatCompletion = await this.client.chat.completions.create({
            ...params,
        });

        const result = chatCompletion.choices[0]

        return new UserMessage(result?.message?.content || '')
    }



    private async initResponseParams(content: LLMProvider.Params): Promise<OpenAI.Responses.ResponseCreateParamsStreaming> {
        // console.log("openai options", JSON.stringify(content.messages, null, 2))
        const credentials = this.options.credentials
        // console.log("openai credentials", credentials)
        if (!credentials?.access_token) {
            throw new Error("Please authorize with OAuth2 first")
        }

        const modelOptions = this.options.modelName

        const messages = await OpenAIUtil.convertMessagesToOpenAIResponseMessages(this.options, content.messages)

        const tools = OpenAIUtil.convertToolsToOpenAIResponseTools(content.tools)

        let params: OpenAI.Responses.ResponseCreateParamsStreaming = {
            model: modelOptions?.value,
            instructions: codex_instructions,
            input: messages,
            stream: true,
            tool_choice: "auto",
            parallel_tool_calls: false,
            store: false,
            include: [],
            prompt_cache_key: "d36d744d-0c64-4b25-9c5a-3e132dbb2e18",
        }

        let reasoning_effort = this.options?.reasoning_effort?.value || this.options?.reasoning_effort_new?.value
        if (reasoning_effort && reasoning_effort !== "off") {
            params.reasoning = {
                effort: reasoning_effort,
                summary: "auto"
            }
        }

        if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
            params.tools = tools
        }

        // console.log("params", JSON.stringify(params, null, 2))

        return params
    }


    private async initParams(content: LLMProvider.Params) {
        // console.log("openai options", JSON.stringify(this.options, null, 2))
        const credentials = this.options.credentials
        // console.log("openai credentials", credentials)
        if (!credentials?.apiKey) {
            throw new Error("API key is required")
        }

        const modelOptions = this.options.modelName

        const messages = await OpenAIUtil.convertMessagesToOpenAIMessages(this.options, content.messages)

        const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools)


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


        let reasoning_effort = this.options?.reasoning_effort?.value || this.options?.reasoning_effort_new?.value
        if (reasoning_effort && reasoning_effort !== "off") {
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
        const credentials = options.credentials
        // console.log("credentials", credentials)
        if (credentials?.credentials_type?.value === 'oauth2') {
            const client = new OpenAI({
                apiKey: 'key',
                defaultHeaders: {
                    "Authorization": `Bearer ${credentials.access_token}`,
                    "chatgpt-account-id": credentials.account_id,
                    "OpenAI-Beta": "responses=experimental",
                    "session_id": "a55064f6-4010-4e60-876d-a7ca1cb8d401"
                },
                fetch: async (url, init) => {
                    // console.log("url", url, init)
                    return fetch("https://chatgpt.com/backend-api/codex/responses", init)
                }
            });
            return client
        }

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








