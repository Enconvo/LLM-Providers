import { BaseChatMessage, BaseChatMessageChunk, UserMessage, Stream, res, AssistantMessage, AudioPlayer } from "@enconvo/api";
import { workerData } from "worker_threads";


export abstract class LLMProvider {
    protected options: LLMProvider.LLMOptions;

    constructor(options: LLMProvider.LLMOptions) {
        this.options = options
    }

    protected abstract _call(content: { messages: BaseChatMessage[] }): Promise<BaseChatMessage>;

    protected abstract _stream(content: { messages: BaseChatMessage[] }): Promise<Stream<BaseChatMessageChunk>>;



    // Overload signatures
    stream(params: LLMProvider.NoHandleParams): Promise<Stream<BaseChatMessageChunk>>;
    stream(params: LLMProvider.AutoHandleParams): Promise<BaseChatMessage>;



    // Implementation
    async stream(params: LLMProvider.NoHandleParams | LLMProvider.AutoHandleParams): Promise<Stream<BaseChatMessageChunk> | BaseChatMessage> {
        // if ('autoHandle' in params && params.autoHandle === true) {
        //     const stream = await this._stream({ messages: params.messages });

        //     let result = "";

        //     for await (const chunk of stream) {
        //         const token = chunk.content as string;
        //         const action = result.length <= 0 ? res.WriteAction.OverwriteLastMessageLastTextContent : res.WriteAction.AppendToLastMessageLastTextContent;

        //         if (token) {
        //             //@ts-ignore
        //             if (additionalContent && additionalContent.length > 0) {

        //                 const message = new AssistantMessage([
        //                     {
        //                         type: 'text',
        //                         text: token
        //                     },
        //                     ...additionalContent
        //                 ])

        //                 await res.write({
        //                     content: message,
        //                     action
        //                 })
        //             } else {

        //                 await res.write({
        //                     content: token,
        //                     action
        //                 })
        //             }

        //             result += token;
        //             if (options.auto_audio_play) {
        //                 AudioPlayer.playStreamText({
        //                     text: result,
        //                     ttsOptions: options.tts_providers
        //                 })
        //             }
        //         }
        //     }

        //     console.log('result', result)

        //     if (options.auto_audio_play) {
        //         AudioPlayer.playStreamText({
        //             text: result,
        //             streamEnd: true,
        //             ttsOptions: options.tts_providers
        //         })
        //     }
        //     return result

        // }

        return this._stream({ messages: params.messages });
    }


    // Call method overload signatures
    call(params: LLMProvider.NoHandleParams): Promise<BaseChatMessage>;
    call(params: LLMProvider.AutoHandleParams): Promise<BaseChatMessage>;

    // Call method implementation
    async call(params: LLMProvider.NoHandleParams | LLMProvider.AutoHandleParams): Promise<BaseChatMessage> {
        if ('autoHandle' in params && params.autoHandle === true) {
            const result = await this._call({ messages: params.messages });
            return result;
        }
        return this._call({ messages: params.messages });
    }
}

export namespace LLMProvider {

    export type LLMOptions = {
        [key: string]: any;
    };

    export interface Params {
        messages: BaseChatMessage[];
    }
    export interface AutoHandleParams extends Params {
        autoHandle: true
    }

    export interface NoHandleParams extends Params {
        autoHandle?: false | null
    }
}


export const isOpenAIO1Model = (modelName: string) => {
    const isOpenAIO1Model = modelName === "openai/o1-mini"
        || modelName === "openai/o1-preview"
        || modelName === "o1-mini"
        || modelName === "o1-preview"
    return isOpenAIO1Model
}

export const isSupportSystemMessage = (llmOptions: any) => {
    // console.log("llmOptions", llmOptions)

    const isPremAI = llmOptions.commandName === 'premai' || llmOptions.originCommandName === 'premai'
    const isCohere = llmOptions.commandName === "chat_cohere" || llmOptions.originCommandName === "chat_cohere"

    const modelName: string = llmOptions?.modelName?.value || llmOptions?.model?.value || ''

    const isYi = llmOptions.commandName === "chat_yii" || llmOptions.originCommandName === "chat_yii"
    const isYiVisionModel = modelName === 'yi-vl-plus'

    const isGroq = llmOptions.commandName === "chat_groq" || llmOptions.originCommandName === "chat_groq"
    const isGroqVisionModel = modelName === 'llava-v1.5-7b-4096-preview' || modelName === 'llama-3.2-11b-vision-preview'


    if (isPremAI || isCohere || (isYi && isYiVisionModel) || (isGroq && isGroqVisionModel) || isOpenAIO1Model(modelName)) {
        return false
    }

    return true
}

export const isSupportSystemPrompt = (llmOptions: any) => {
    if (llmOptions.commandName === 'premai' || llmOptions.originCommandName === 'premai') {
        return true
    }
    return false
}

export const isSupportMultiUserMessage = (llmOptions: any) => {
    const isGroq = llmOptions.commandName === "chat_groq" || llmOptions.originCommandName === "chat_groq"
    const isGroqVisionModel = llmOptions?.modelName?.value === 'llava-v1.5-7b-4096-preview'

    if (isGroq && isGroqVisionModel) {
        return false
    }

    return true
}
