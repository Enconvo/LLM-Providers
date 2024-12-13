
import { ChatVertexAI } from "@langchain/google-vertexai";


import { ChatGroq } from "@langchain/groq";
import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProvider, LLMOptions, LLMResult } from "./llm_provider.ts";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProvider {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        options.temperature = Number(options.temperature.value);

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.model = modelName;


        const model = new ChatVertexAI({
            ...options,
            authOptions: {
                projectId: options.project_id,
            }
        })

        return model
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}