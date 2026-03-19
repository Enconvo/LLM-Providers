import { AssistantMessage, ChatMessageContent, EnconvoResponse, environment, res, uuid } from "@enconvo/api"

export default async function main(req: Request) {
    // let providerOptions = await CommandManageUtils.loadCommandConfig({ commandKey: "agent|main", useAsRunParams: true })
    // let providerOptions = await CommandManageUtils.getProviderOptions("llm")
    // console.log('llm providerOptions 2', providerOptions)
    // const llmProvider: LLMProvider = ServiceProvider.load({ ...providerOptions })

    console.log("write", environment.chatSessionId)
    await res.write({ content: new AssistantMessage([ChatMessageContent.text({ text: 'hello', id: uuid() })]), action: EnconvoResponse.WriteAction.AppendToLastMessageLastTextContent, callId: environment.chatConversationId })
    console.log("write end", environment.chatSessionId)
    return "hello"
}
