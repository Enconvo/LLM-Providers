import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";
import { Runnable } from "@langchain/core/runnables";
import { env } from "process";

export default function main(options: any) {
    return new AnthropicOpenAIProvider({ options })
}

export class AnthropicOpenAIProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName;
        options.streaming = true;
        options.anthropicApiUrl = options.anthropicApiUrl || "https://api.anthropic.com";


        let config: any = {
            defaultHeaders: {
                ...options.headers,
                "accessToken": `${env['accessToken']}`,
                "client_id": `${env['client_id']}`,
                "commandKey": `${env['commandKey']}`
            },
        }

        return new ChatAnthropic({
            ...options,
            clientOptions: config
        });
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}