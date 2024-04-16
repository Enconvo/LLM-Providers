import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature.value);

    const modelOptions = options.modelName
    const modelName = modelOptions.value
    options.modelName = modelName;

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

