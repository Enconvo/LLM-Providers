import { AssistantMessage, BaseChatMessage, BaseChatMessageChunk, LLMProvider, Stream } from "@enconvo/api";
import Anthropic from '@anthropic-ai/sdk';
import ollama from 'ollama'
import { OllamaUtil } from "./utils/ollama_util.ts";
import axios from 'axios'
import { createReadStream } from 'node:fs';
import FormData from 'form-data';

export default function main(options: any) {
    return new StraicoProvider(options)
}

export class StraicoProvider extends LLMProvider {
    anthropic: Anthropic

    constructor(options: LLMProvider.LLMOptions) {
        super(options)

        this.anthropic = new Anthropic({
            apiKey: options.anthropicApiKey, // defaults to process.env["ANTHROPIC_API_KEY"]
        });


    }

    protected async _call(content: { messages: BaseChatMessage[]; }): Promise<BaseChatMessage> {
        const newMessages = OllamaUtil.convertMessagesToOllamaMessages(content.messages)

        const params = this.initParams()

        const response = await ollama.chat({ ...params, messages: newMessages })

        return new AssistantMessage(response.message.content)
    }

    protected async _stream(content: { messages: BaseChatMessage[]; }): Promise<Stream<BaseChatMessageChunk>> {


        const response = await this.request(content.messages)


        async function* iterator(): AsyncIterator<BaseChatMessageChunk, any, undefined> {
            yield new AssistantMessage(response)
        }

        const controller = new AbortController();

        return new Stream(iterator, controller);

    }


    initParams() {

        return {
            model: this.options.modelName.value,
            temperature: this.options.temperature.value
        }

    }


    async request(messages: BaseChatMessage[]) {
        const newMessages = await this.convertMessagesToOpenAIMessages(messages)

        const files = newMessages.map((message) => {
            return message.files
        }).flat()

        const lastMessage = newMessages.pop();
        const userInput = lastMessage?.text.content || '';

        const history = newMessages.map((message) => {
            return `${message.text.role}: ${message.text.content}`
        }).join("\n")


        const prompt = `history messages:\n${history}\n\nuser input:\n${userInput}`

        var data = JSON.stringify({
            "models": [
                this.options.modelName.value,
            ],
            "message": prompt,
            "temperature": this.options.temperature.value
        });

        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://api.straico.com/v1/prompt/completion',
            headers: {
                'Authorization': `Bearer ${this.options.api_key}`,
                'Content-Type': 'application/json'
            },
            data: data
        };

        console.log("config", JSON.stringify(config))

        try {
            const response = await axios(config)
            const modelResponse = response.data.data.completions[this.options.modelName.value]
            const modelResponseContent = modelResponse.completion.choices[0].message.content
            console.log(modelResponseContent)
            return modelResponseContent

        } catch (error) {
            console.log(error)
        }
    }


    private async convertMessageToOpenAIMessage(message: BaseChatMessage): Promise<{ text: BaseChatMessage; files: string[]; }> {
        let role = message.role

        if (typeof message.content === "string") {
            return {
                text: {
                    role: role,
                    content: message.content
                },
                files: []
            }
        } else {

            const content = message.content.filter((item) => {
                return item.type === "text"
            }).map((item) => {
                return item.text
            })

            const images = message.content.filter((item) => {
                return item.type === "image_url"
            }).filter((item) => item.image_url.url.startsWith("file://")).map(async (item) => {
                const url = item.image_url.url
                return await this.uploadFile(url)
            })
            const files = await Promise.all(images)

            return {
                text: {
                    role: role,
                    content: content.join("\n")
                },
                files: files
            }
        }
    }


    private async convertMessagesToOpenAIMessages(messages: BaseChatMessage[]): Promise<{ text: BaseChatMessage; files: string[]; }[]> {

        let newMessages = messages.map((message) => this.convertMessageToOpenAIMessage(message))
        return await Promise.all(newMessages)
    }


    private async uploadFile(fileUrl: string): Promise<string> {
        return ""
        var data = new FormData();
        const file = createReadStream(fileUrl.replaceAll("file://", ""))
        data.append('file', file);

        var config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://api.straico.com/v0/file/upload',
            headers: {
                'Authorization': `Bearer ${this.options.api_key}`,
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders()
            },
            data: data
        };

        try {
            const response = await axios(config)
            return response.data.data.url
        } catch (error) {
            console.log(error)
            return ""
        }
    }

}