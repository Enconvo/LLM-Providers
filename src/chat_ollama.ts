import {ChatOllama} from "langchain/chat_models/ollama";

export default function main(options: any) {

    const model = new ChatOllama({
        ...options
    });

    return model;
}

