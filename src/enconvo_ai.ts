import { BaseChatMessage, Stream, BaseChatMessageChunk, LLMProvider } from "@enconvo/api";


export default function main(options: any) {

    return new EnconvoAIProvider(options)
}

class EnconvoAIProvider extends LLMProvider {

    llmProvider?: LLMProvider

    constructor(options: LLMProvider.LLMOptions) {
        super(options)
    }

    protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        const llmProvider = await this.initLLMProvider()

        return llmProvider.call(content)
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const llmProvider = await this.initLLMProvider()

        return llmProvider.stream(content)
    }



    async initLLMProvider() {
        if (this.llmProvider) {
            return this.llmProvider
        }

        const newLLMArr = this.options.modelName.value.split("/")
        const modelProvider = newLLMArr[0]

        const anthropicApiUrl = "https://api.enconvo.com/"
        const openAIBaseUrl = "https://api.enconvo.com/v1/"
        const googleApiUrl = "https://api.enconvo.com"
        // const anthropicApiUrl = "http://127.0.0.1:8181/"
        // const openAIBaseUrl = "http://127.0.0.1:8181/v1/"
        // const googleApiUrl = "http://127.0.0.1:8181"

        switch (modelProvider) {
            case "anthropic":
                this.options.commandName = "chat_anthropic";
                this.options.anthropicApiUrl = anthropicApiUrl
                break;
            case "google":
                this.options.commandName = "chat_google";
                this.options.baseUrl = googleApiUrl
                break;
            default:
                this.options.commandName = "chat_open_ai";
                this.options.baseUrl = openAIBaseUrl
                break;
        }
        this.options.extensionName = "llm";

        const llmProvider: LLMProvider = await LLMProvider.fromOptions(this.options)

        this.llmProvider = llmProvider

        return llmProvider
    }

}

