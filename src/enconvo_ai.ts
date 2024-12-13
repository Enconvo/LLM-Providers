import { LLMOptions, LLMProvider, LLMResult } from "./llm_provider.ts";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ServiceProvider } from "./provider.ts";
import { StructuredToolInterface } from "@langchain/core/tools";


export default function main(options: any) {

    return new EnconvoAIProvider({ options, autoInit: false })
}

class EnconvoAIProvider extends LLMProvider {

    originalTools: StructuredToolInterface[] = []
    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {
        const llmArr = (this.options.modelName.value || this.options.modelName).split("/")
        let modelProvider = llmArr[0]
        let newLLMOptions: LLMOptions = {}

        this.resetTools()

        newLLMOptions = this.options

        if (modelProvider === 'anthropic') {
            delete newLLMOptions.frequency_penalty
            delete newLLMOptions.presence_penalty

        }


        await this.initLCChatModel(JSON.parse(JSON.stringify(newLLMOptions)))

        // console.log("bindings", this.bindings)
        this.lcChatModel = this.lcChatModel?.bind(this.bindings)

        if (this.tools.length > 0) {
            //@ts-ignore
            this.lcChatModel = this.lcChatModel?.bind({ tools: this.tools })
        }


        const stream = await this.lcChatModel?.stream(messages)
        return {
            stream
        }
    }

    resetTools() {
        if (this.tools.length <= 0) {
            this.tools = this.originalTools
        }
    }

    clearTools() {
        this.originalTools = this.tools
        this.tools = []
    }

    protected async _initLCChatModel(newLLMOptions: LLMOptions): Promise<Runnable | undefined> {
        // console.log("LLLLLLLLL", newLLMOptions)
        const newLLMArr = (newLLMOptions.modelName.value || newLLMOptions.modelName).split("/")
        const modelProvider = newLLMArr[0]

        const anthropicApiUrl = "https://api.enconvo.com/"
        const openAIBaseUrl = "https://api.enconvo.com/v1/"
        // const anthropicApiUrl = "http://127.0.0.1:8181/"
        // const openAIBaseUrl = "http://127.0.0.1:8181/v1/"

        switch (modelProvider) {
            case "anthropic":
                newLLMOptions.commandName = "chat_anthropic";
                newLLMOptions.anthropicApiUrl = anthropicApiUrl
                break;
            default:
                newLLMOptions.commandName = "chat_open_ai";
                newLLMOptions.baseUrl = openAIBaseUrl
                break;
        }
        newLLMOptions.extensionName = "llm";

        const llmProvider: LLMProvider = ServiceProvider.load(newLLMOptions)
        this.lcChatModel = await llmProvider.initLCChatModel(newLLMOptions)
        return this.lcChatModel
    }



    isVisionEnabled(messages: BaseMessage[]) {
        let visionEnabled = false

        for (const message of messages) {
            if (typeof message.content === 'string') {
                continue
            }
            if (typeof message.content === 'object') {
                // array
                for (const content of message.content) {
                    if (content.type === 'image_url') {
                        visionEnabled = true
                        break
                    }
                }
            }
            if (visionEnabled) {
                break
            }
        }
        return visionEnabled
    }
}

