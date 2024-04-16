import { ChatMistralAI } from "@langchain/mistralai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature.value);
    options.modelName = options.modelName.value

    console.log(options)

    const model = new ChatMistralAI({
        ...options,

    });

    return model

}

