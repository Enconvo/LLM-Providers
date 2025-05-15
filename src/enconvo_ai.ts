import { LLMProvider } from "@enconvo/api";


export default async function main(options: LLMProvider.LLMOptions) {

    return await initLLMProvider(options)
}


async function initLLMProvider(options: LLMProvider.LLMOptions) {
    const newLLMArr = options.modelName.value.split("/")
    const modelProvider = newLLMArr[0]

    const anthropicApiUrl = "https://api.enconvo.com/"
    const openAIBaseUrl = "https://api.enconvo.com/v1/"
    const googleApiUrl = "https://api.enconvo.com"
    // const anthropicApiUrl = "http://127.0.0.1:8181/"
    // const openAIBaseUrl = "http://127.0.0.1:8181/v1/"
    // const googleApiUrl = "http://127.0.0.1:8181"

    switch (modelProvider) {
        case "anthropic":
            options.commandName = "chat_anthropic";
            options.anthropicApiUrl = anthropicApiUrl
            break;
        case "google":
            options.commandName = "chat_google";
            options.baseUrl = googleApiUrl
            break;
        default:
            options.commandName = "chat_open_ai";
            options.baseUrl = openAIBaseUrl
            break;
    }

    options.extensionName = "llm";
    options.originCommandName = "enconvo_ai";

    const llmProvider: LLMProvider = await LLMProvider.fromOptions(options)

    return llmProvider
}