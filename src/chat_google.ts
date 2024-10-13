import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

import { Runnable } from "langchain/runnables";
import { BaseMessage } from "langchain/schema";
import { LLMProviderBase, LLMOptions, LLMResult } from "./llm_provider.ts";
import { env } from "process";



export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        // change options.temperature to number
        options.temperature = Number(options.temperature.value);

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName
        if (options.apiKey === "default") {
            options.apiKey = `${env['accessToken']}`
        }

        const baseUrl = options.baseUrl
        // 取 host + port
        if (baseUrl) {
            const url = new URL(baseUrl)
            options.baseUrl = url.protocol + '//' + url.host
            console.log('options', options)
        }

        // streaming to boolean
        // options.streaming = options.stream === "true";


        /*
         * Before running this, you should make sure you have created a
         * Google Cloud Project that has `generativelanguage` API enabled.
         *
         * You will also need to generate an API key and set
         * an environment variable GOOGLE_API_KEY
         *
         */

        // Text
        const model = new ChatGoogleGenerativeAI({
            ...options,
            maxOutputTokens: 2048,
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                },
            ],
        });

        return model
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }



}