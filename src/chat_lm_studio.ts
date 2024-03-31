import { ChatOpenAI } from "langchain/chat_models/openai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

    // streaming to boolean
    options.stream = options.stream === "true";

    let config: any = {
        baseURL: options.baseUrl,
        defaultHeaders: options.headers
    }

    return new ChatOpenAI({
        openAIApiKey: 'sk-1234567890',
        ...options,
        configuration: config
    },
    );
}

