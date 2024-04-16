import { ChatOllama } from "langchain/chat_models/ollama";

export default function main(options: any) {
    console.log("Options: ", options);
    // options.temperature = Number(options.temperature.value);

    const modelOptions = options.model
    const modelName = modelOptions.value
    options.model = modelName;

    const model = new ChatOllama({
        ...options
    });

    return model;
}

