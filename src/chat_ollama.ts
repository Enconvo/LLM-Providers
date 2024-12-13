import { ChatOllama } from "langchain/chat_models/ollama";

import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProvider, LLMOptions, LLMResult } from "./llm_provider.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProvider {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        options.temperature = Number(options.temperature.value);

        const modelOptions = options.model
        const modelName = modelOptions.value
        options.model = modelName;
        // console.log("options", options)
        options.baseUrl = options.baseUrl || "http://127.0.0.1:11434"; 

        const model = new ChatOllama({
            
            ...options
        });

        return model;
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}