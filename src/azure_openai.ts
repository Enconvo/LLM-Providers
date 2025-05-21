import { BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream, UserMessage } from '@enconvo/api';
import { AzureOpenAI } from 'openai';
import { OpenAIUtil } from './utils/openai_util.ts';


export default function main(options: any) {
    return new ChatOpenAIProvider(options)
}


class ChatOpenAIProvider extends LLMProvider {

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {

        const params = this.initParams(content)
        // console.log("params", params)

        const chatCompletion = await this.client.chat.completions.create({
            ...params,
            stream: true
        });

        const ac = new AbortController()
        //@ts-ignore
        const stream = OpenAIUtil.streamFromOpenAI(chatCompletion, ac)
        return stream

    }


    client: AzureOpenAI
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
        if (!this.options.azureOpenAIApiKey) {
            throw new Error("API key is required")
        }

        if (!this.options.azureOpenAIApiEndpoint) {
            throw new Error("Endpoint is required")
        }

        if (!this.options.azureOpenAIApiVersion) {
            throw new Error("API version is required")
        }

        const modelOptions = this.options.modelName
        if (!modelOptions) {
            throw new Error("Model name is required")
        }

        const messages = OpenAIUtil.convertMessagesToOpenAIMessages(this.options, content.messages)

        const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools)

        let reasoning_effort = this.options?.reasoning_effort?.value === "off" ? null : this.options?.reasoning_effort?.value


        let temperature = this.options.temperature.value
        try {
            temperature = typeof temperature === "string" ? parseFloat(temperature) : temperature
        } catch (e) {
            temperature = 0.5
        }

        let params: any = {
            temperature: temperature,
            messages
        }

        if (reasoning_effort) {
            params.reasoning_effort = reasoning_effort
        }

        if (tools && tools.length > 0 && modelOptions.toolUse === true) {
            params = {
                ...params,
                tools,
                tool_choice: content.tool_choice,
                parallel_tool_calls: modelOptions.toolUse === true ? false : null,
            }
        }


        return params
    }

    private _createOpenaiClient(options: LLMProvider.LLMOptions): AzureOpenAI {

        const client = new AzureOpenAI({
            apiKey: options.azureOpenAIApiKey,
            apiVersion: options.azureOpenAIApiVersion,
            endpoint: options.azureOpenAIApiEndpoint,
            deployment: options.modelName.value,
        });

        // if (env['LANGCHAIN_TRACING_V2'] === 'true') {
        //     return wrapOpenAI(client)
        // }

        return client
    }
}








