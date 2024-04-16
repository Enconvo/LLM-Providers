import { ChatOpenAI } from "langchain/chat_models/openai";

export default function main(options: any) {
    console.log("options", options);
    // change options.temperature to number
    options.temperature = Number(options.temperature.value);
    // streaming to boolean
    options.modelName = options.modelName.value;


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

