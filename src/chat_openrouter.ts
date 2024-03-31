import { ChatOpenAI } from "langchain/chat_models/openai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    // streaming to boolean
    options.stream = options.stream === "true";


    let config: any = {
        baseURL: options.baseUrl,
        defaultHeaders: {
            'X-Title': "Enconvo",
            'Http-Referer': "https://enconvo.com",
            ...options.headers
        }
    }

    return new ChatOpenAI({
        ...options,
        configuration: config
    }
    );
}

