import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ServiceProvider } from "./provider.ts";

export default function main(options: any): BaseChatModel {

    const modelArr = options.modelName.value.split("/")
    console.log("options---", options)
    const provider = modelArr[0]
    switch (provider) {
        case "openai":
            options.commandName = "chat_open_ai";
            break;
        case "enconvoai":
            options.commandName = "chat_open_ai";
            break;
        case "anthropic":
            options.commandName = "chat_anthropic";
            break;

        default:
            break;
    }
    options.extensionName = "llm";

    const chat: BaseChatModel = ServiceProvider.load(options);

    return chat;
}

