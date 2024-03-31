import { ChatMistralAI } from "@langchain/mistralai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);

    // streaming to boolean
    // options.streaming = options.stream === "true";

    const model = new ChatMistralAI({
        ...options,
        
    });

    return model

}

