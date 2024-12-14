import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";
import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import { LangchainUtil } from "./utils/langchain_util.ts";
import { BaseMessageLike } from "@langchain/core/messages";




export default function main(options: any) {
    return new ChatCloudflareWorkersProvider(options)
}

export class ChatCloudflareWorkersProvider extends LLMProvider {
    model: ChatCloudflareWorkersAI
    constructor(options: LLMProvider.LLMOptions) {
        super(options)
        this.model = this._initLangchainChatModel(this.options)
    }


    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {
        const newMessages = this.convertMessagesToLangchainMessages(content.messages)

        const msg = await this.model.invoke(newMessages)
        const result = msg.content as string
        return new AssistantMessage(result)
    }

    protected async _stream(content: { messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {
        const newMessages = this.convertMessagesToLangchainMessages(content.messages)

        const stream = await this.model.stream(newMessages)
        const controller = new AbortController()
        controller.signal.addEventListener('abort', () => {
            stream.cancel()
        })

        return LangchainUtil.streamFromLangchain(stream, controller)
    }


    private _initLangchainChatModel(options: LLMProvider.LLMOptions) {

        const modelOptions = options.modelName
        const modelName = modelOptions.value
        options.modelName = modelName;

        const model = new ChatCloudflareWorkersAI({
            model: options.modelName, // Default value
            cloudflareAccountId: options.account_id,
            cloudflareApiToken: options.apiKey,
            ...options,
        });

        return model;

    }


    convertMessageToLangchainMessage(message: BaseChatMessage): BaseMessageLike {

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

    convertMessagesToLangchainMessages(messages: BaseChatMessage[]): BaseMessageLike[] {
        return messages.map((message) => this.convertMessageToLangchainMessage(message))
    }

}
