
import { ChatLlamaCpp } from "@langchain/community/chat_models/llama_cpp";
import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProvider, LLMOptions, LLMResult } from "./llm_provider.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProvider {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {

        // options.temperature = Number(options.temperature.value);

        // const modelOptions = options.model
        // const modelName = modelOptions.value
        // options.model = modelName;

        
        const llamaPath = "/Users/ysnows/Downloads/phi-2.Q4_K_S.gguf";

        const model = new ChatLlamaCpp({ modelPath: llamaPath });

        return model;
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}