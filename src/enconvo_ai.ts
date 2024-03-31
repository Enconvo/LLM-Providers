import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export default function main(options: any): BaseChatModel {
    
    // change options.temperature to number
    // const modelArr = options.modelName.split("/")
    // const provider = modelArr[0]
    // switch (provider) {
    //     case "openai":
    //         options.commandName = "chat_open_ai";
    //         break;
    //     case "anthropic":
    //         options.commandName = "chat_anthropic";
    //         break;
    //     case "groq":
    //         options.commandName = "chat_groq";
    //         break;

    //     default:
    //         break;
    // }
    // options.extensionName = "llm";

    // const chat = llm.chatModel(options);

    return chat;
}

