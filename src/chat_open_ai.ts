import { ChatOpenAI } from "langchain/chat_models/openai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

    if (options.modelName === "gpt-3.5-turbo-1106" || options.modelName === "gpt-4-1106-preview" || options.modelName === "gpt-4-vision-preview" || options.modelName === "openai/gpt4-vision") {
        options.maxTokens = Number(options.maxTokens || "4096");
    }
    // streaming to boolean
    options.stream = options.stream === "true";
    let customHeaders = {}
    try {
        customHeaders = JSON.parse(options.customHeaders)
    } catch (error) {

    }

    let config: any = {
        baseURL: options.baseUrl,
        defaultHeaders: {
            ...options.headers,
            ...customHeaders
        }
    }
    console.log("config", config)

    return new ChatOpenAI({
        ...options,
        configuration: config
    },
    );
}

