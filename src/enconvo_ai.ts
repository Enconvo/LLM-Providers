import { LLMOptions, LLMProviderBase, LLMResult } from "./llm_provider.ts";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ServiceProvider } from "./provider.ts";


export default function main(options: any) {

    return new EnconvoAIProvider({ options, autoInit: false })
}

class EnconvoAIProvider extends LLMProviderBase {

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {
        const llmArr = this.options.modelName.value.split("/")
        let modelProvider = llmArr[0]
        let newLLMOptions: LLMOptions = {}


        newLLMOptions = this.options
        if (modelProvider === 'anthropic') {
            delete newLLMOptions.frequency_penalty
            delete newLLMOptions.presence_penalty

        } else if (modelProvider === 'openai') {


        } else if (modelProvider === 'enconvoai') {
            // 如果带有 tools就用 openai
            // 其他的用anthropic
            const toolUse = this.tools.length > 0
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

            if (toolUse && !visionEnabled) {
                let modelName = newLLMOptions.modelName
                modelName.value = 'openai/gpt-3.5-turbo'
                newLLMOptions.modelName = modelName
                console.log("modelName", modelName)
            } else {
                if (visionEnabled) {
                    this.tools = []
                }

                let modelName = newLLMOptions.modelName
                modelName.value = 'anthropic/claude-3-haiku-20240307'
                newLLMOptions.modelName = modelName
            }

        }


        await this.initLCChatModel(newLLMOptions)
        // console.log("newLLMLL", this.tools)
        if (this.tools.length > 0) {
            //@ts-ignore
            this.lcChatModel = this.lcChatModel?.bind({ tools: this.tools })
        }

        const stream = await this.lcChatModel?.stream(messages)
        return {
            stream
        }
    }


    protected async _initLCChatModel(newLLMOptions: LLMOptions): Promise<Runnable | undefined> {
        // console.log("LLLLLLLLL", newLLMOptions)
        const newLLMArr = newLLMOptions.modelName.value.split("/")
        const modelProvider = newLLMArr[0]

        switch (modelProvider) {
            case "openai":
                newLLMOptions.commandName = "chat_open_ai";
                break;
            case "enconvoai":
                newLLMOptions.commandName = "chat_open_ai";
                break;
            case "anthropic":
                newLLMOptions.commandName = "chat_anthropic";
                break;

            default:
                break;
        }
        newLLMOptions.extensionName = "llm";

        const llmProvider: LLMProviderBase = ServiceProvider.load(newLLMOptions)
        this.lcChatModel = await llmProvider.initLCChatModel(newLLMOptions)
        return this.lcChatModel
    }
}

