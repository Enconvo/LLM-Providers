import { ChatPrem } from "@langchain/community/chat_models/premai";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";
import { Runnable } from "@langchain/core/runnables";
import { AnthropicOpenAIProvider } from "./chat_anthropic.ts";


export default function main(options: any) {
    return new AnthropicOpenAIProvider({ options })
    // return new PremAIProvider({ options })
}

// class PremAIProvider extends LLMProviderBase {
//     protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

//         const stream = await this.lcChatModel?.stream(messages)

//         return {
//             stream
//         }
//     }


//     protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
//         // options.temperature = Number(options.temperature.value);

//         // const modelOptions = options.model
//         // const modelName = modelOptions.value
//         // options.model = modelName;


//         // const model = new ChatPrem({
//         //     ...options,
//         // });

//         // return model;
//         return undefined
//     }
// }