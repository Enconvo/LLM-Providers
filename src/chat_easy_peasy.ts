import {
    BaseChatModelCallOptions,
    type BaseChatModelParams,
    SimpleChatModel,
} from "@langchain/core/language_models/chat_models";
import {ChatGenerationChunk} from "@langchain/core/outputs";
import {CallbackManagerForLLMRun} from "@langchain/core/callbacks/manager";
import {Runnable} from "langchain/runnables";
import {AIMessageChunk, BaseMessage} from "langchain/schema";
import {LLMOptions, LLMProviderBase, LLMResult} from "./llm_provider.ts";

/**
 * doc: https://app.swaggerhub.com/apis-docs/Easy-Peasy.AI/Easy-Peasy.AI/1.0.1#/GenerateRequest
 */
interface EasyPeasyGeneratorRequestBody {
    /**
     * Template name
     */
    preset:	string;
    /**
     * What do you want to generate? (maxlength: 1000)
     */
    keywords:	string;
    tone?:	string;
    /**
     * Background Information (optional) (maxlength: 1000)
     */
    extra1?:	string;
    extra2?:	string;
    extra3?:	string;
    /**
     * Number of outputs (default: 1)
     */
    outputs?:	number;
}

interface EasyPeasyGeneratorResponseItem {
    id: number;
    text: string;
}

type EasyPeasyGeneratorResponseBody  = EasyPeasyGeneratorResponseItem[]

/**
 * call EasyPeasy generate api
 */
async function callEasyPeasyGenerateApi(data: EasyPeasyGeneratorRequestBody, options: { headers: RequestInit['headers'] & {'x-api-key': string}, signal?: RequestInit['signal'] }): Promise<EasyPeasyGeneratorResponseBody> {
    const api = 'https://easy-peasy.ai/api/generate';
    const response = await fetch(api, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        signal: options.signal,
    });
    if (!response.ok) {
        let error;
        const responseText = await response.text();
        try {
            const json = JSON.parse(responseText);
            error = new Error(`EasyPeasy call failed with status code ${response.status}: ${json.error}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (e) {
            error = new Error(`EasyPeasy call failed with status code ${response.status}: ${responseText}`);
        }
        // @ts-ignore
        error.response = response;
        throw error;
    }
    if (!response.body) {
        throw new Error("Could not begin EasyPeasy stream. Please check the given URL and try again.");
    }
    return await response.json();
}

export interface EasyPeasyChatModelInput extends  BaseChatModelParams {
    xApiKey: string;
    extra1: EasyPeasyGeneratorRequestBody['extra1'];
    maxHistory: number;
}

/**
 * fill the messages (join with '\n') into the extra fields
 * ex: _flatToExtraArray(['123', '45', '6'], 2, 3) // return [ '3\n', '45', '\n6' ]
 */
function _flatToExtraArray(messages: string[], maxWordsPreExtra: number, extraCount: number) {
    const extraStringArray: string[] = [];
    const stringMessages = messages.join('\n');
    let extraAllStrings = stringMessages.substring(stringMessages.length - maxWordsPreExtra * extraCount);
    for (let i = 0; i < extraCount; i++) {
        const head = extraAllStrings.substring(0, maxWordsPreExtra);
        if (head) {
            extraStringArray.push(head);
        }
        extraAllStrings = extraAllStrings.substring(maxWordsPreExtra);
    }
    return extraStringArray;
}

interface EasyPeasyChatModelCallOptions extends BaseChatModelCallOptions {
}

export class EasyPeasyChatModel extends SimpleChatModel<EasyPeasyChatModelCallOptions> {
    protected xApiKey: string;
    protected extra1?: string;
    protected maxHistory: number;

    constructor(fields: EasyPeasyChatModelInput) {
        super(fields);
        this.xApiKey = fields.xApiKey;
        this.extra1 = fields.extra1;
        this.maxHistory =  fields.maxHistory || -1;
    }

    _llmType() {
        return "easy-peasy";
    }

    async _call(
      messages: BaseMessage[],
      options: this["ParsedCallOptions"],
    ): Promise<string> {
        const result = await this._callEasyPeasy(messages, options);
        return result[0].text;
    }

    private async _callEasyPeasy(messages: BaseMessage[], options: this["ParsedCallOptions"]) {
        // check all message type, only support text
        if (!messages.length) {
            throw new Error(`No messages provided. runName: ${options.runName}`);
        }
        for (const message of messages) {
            if (typeof message.content !== "string") {
                throw new Error(`Multimodal messages are not supported. runName: ${options.runName}`);
            }
        }

        // prepare payload for Easy Peasy generate api
        const preset = 'custom-generator';
        const xApiKey = this.xApiKey;
        const keywords = this._generateTextKeywords(messages);
        const extraObject = this._generateTextExtra(messages, this.extra1, {
            maxWordsPreExtra: 1000,
            maxHistory: this.maxHistory,
        });

        // invoke the "generate" api
        const result =  await callEasyPeasyGenerateApi({
            preset,
            keywords,
            ...extraObject,
            outputs: 1
        }, {
            headers: {
                "x-api-key": xApiKey
            }
        });
        // for debug
        // result[0].text = result[0].text+ `===keywords: ${JSON.stringify(keywords)}===` + `===extraObject: ${JSON.stringify(extraObject)}===`
        return result;
    }

    /**
     *
     * use latest message
     */
    private _generateTextKeywords(messages: BaseMessage[]) {
        const latsMessage = messages[messages.length - 1];
        return String(latsMessage.content).slice(0, 1000)
    }

    /**
     * generate extra object
     *
     * presetExtra1 will be treated as background information if provided.
     */
    private _generateTextExtra(messages: BaseMessage[], presetExtra1: string | undefined, options: {maxWordsPreExtra: number, maxHistory: number}): Pick<EasyPeasyGeneratorRequestBody, 'extra1' | 'extra2' | 'extra3'> {
        // init
        const {maxWordsPreExtra, maxHistory} = options;
        const extraObject: Pick<EasyPeasyGeneratorRequestBody, 'extra1' | 'extra2' | 'extra3'>= {
            extra1: presetExtra1 ? presetExtra1 : undefined,
            extra2: undefined,
            extra3: undefined,
        }
        const extraCount = presetExtra1 ? Object.keys(extraObject).length - 1 : Object.keys(extraObject).length;

        // history fill into an extra array
        const history = maxHistory < 0 ? messages : messages.slice(messages.length - maxHistory);
        const textHistoryMessages = history.map(message => `${message._getType()}: ${message.content}`);
        const extraStringArray = _flatToExtraArray(textHistoryMessages, maxWordsPreExtra, extraCount);
        if(presetExtra1) {
            extraObject.extra2 = extraStringArray[0];
            extraObject.extra3 = extraStringArray[1];
        } else {
            extraObject.extra1 = extraStringArray[0];
            extraObject.extra2 = extraStringArray[1];
            extraObject.extra3 = extraStringArray[2];
        }
        return  extraObject;
    }

    async *_streamResponseChunks(
      messages: BaseMessage[],
      options: this["ParsedCallOptions"],
      runManager?: CallbackManagerForLLMRun
    ): AsyncGenerator<ChatGenerationChunk> {
        const result = await  this._callEasyPeasy(messages, options);

        // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
        // await subRunnable.invoke(params, runManager?.getChild());
        for (const letter of result[0].text) {
            yield new ChatGenerationChunk({
                message: new AIMessageChunk({
                    content: letter,
                }),
                text: letter,
            });
            // Trigger the appropriate callback for new chunks
            await runManager?.handleLLMNewToken(letter);
        }
    }
}


export default function main(options: any) {
    return new LLMProvider({ options })
}

export class LLMProvider extends LLMProviderBase {
    protected async _initLCChatModel(options: LLMOptions): Promise<Runnable | undefined> {
        // parse options
        const xApiKeyOption = options.xApiKey
        const extra1Option = options.extra1
        const maxHistoryOption = Number(options.maxHistory) || -1;

        const model = new EasyPeasyChatModel({
            xApiKey: xApiKeyOption,
            extra1: extra1Option,
            maxHistory: maxHistoryOption,
        });

        return model;
    }

    protected async _call({ messages }: { messages: BaseMessage[]; }): Promise<LLMResult> {

        const stream = await this.lcChatModel?.stream(messages)

        return {
            stream
        }
    }
}
