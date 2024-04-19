import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "langchain/chat_models/base";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";

export default function main(options: any) {
    return new AnthropicOpenAIProvider({ options })
}

class AnthropicOpenAIProvider extends LLMProviderBase {

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }

    protected _initLCChatModel(options: LLMOptions): BaseChatModel | undefined {

        options.temperature = Number(options.temperature.value);
        options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName;
        options.streaming = true;

        let config: any = {
            defaultHeaders: options.headers
        }

        return new ChatAnthropic({
            ...options,
            clientOptions: config
        });
    }


}