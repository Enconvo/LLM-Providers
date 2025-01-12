import { BaseChatMessage, BaseChatMessageChunk, BaseChatMessageLike, LLMProvider, Stream } from "@enconvo/api";
import { ChatCohere } from "@langchain/cohere"
import { LangchainUtil } from "./utils/langchain_util.ts";
import { BaseMessageLike } from "@langchain/core/messages";



export default function main(options: any) {
    return new CohereAIProvider(options)
}

export class CohereAIProvider extends LLMProvider {
    model: ChatCohere
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.model = this._initLCChatModel(this.options)
    }

    protected _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
        throw new Error("Method not implemented.");
    }

    protected async _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
        const messages = this.convertMessagesToLangchainMessages(content.messages)

        const stream = await this.model.stream(messages)
        const controller = new AbortController()
        controller.signal.addEventListener('abort', () => {
            stream.cancel()
        })

        return LangchainUtil.streamFromLangchain(stream, controller)
    }


    protected _initLCChatModel(options: LLMProvider.LLMOptions) {


        const modelOptions = options.model
        const modelName = modelOptions.value
        options.model = modelName;

        const model = new ChatCohere({
            ...options,
            temperature: options.temperature.value
        })

        return model
    }



    convertMessageToLangchainMessage(message: BaseChatMessageLike): BaseMessageLike {

        if (typeof message.content === "string") {
            //@ts-ignore
            return {
                role: message.role,
                content: message.content
            }
        } else {

            const content = message.content.filter((item) => item.type === "text").map((item) => {
                return item.text
            }).join("\n")

            return {
                role: message.role,
                content: content
            }
        }

    }

    convertMessagesToLangchainMessages(messages: BaseChatMessageLike[]): BaseMessageLike[] {
        return messages.map((message) => this.convertMessageToLangchainMessage(message))
    }

}


