import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  BaseChatMessageLike,
  ChatMessageContent,
  ChatMessageContentText,
  LLMProvider,
  Stream,
  uuid,
} from "@enconvo/api";
import axios from "axios";
import { createReadStream } from "node:fs";
import FormData from "form-data";

export default function main(options: any) {
  return new StraicoProvider(options);
}

export class StraicoProvider extends LLMProvider {
  constructor(options: LLMProvider.LLMOptions) {
    super(options);
  }

  protected async _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    const response = await this.request(content.messages);

    return new AssistantMessage(response);
  }

  protected async _stream(
    content: LLMProvider.Params,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const response = await this.request(content.messages);

    async function* iterator(): AsyncIterator<
      BaseChatMessageChunk,
      any,
      undefined
    > {
      yield {
        model: "Straico",
        id: uuid(),
        choices: [
          {
            delta: {
              content: response,
              role: "assistant",
            },
            finish_reason: null,
            index: 0,
          },
        ],
        created: Date.now(),
        object: "chat.completion.chunk",
      };
    }

    const controller = new AbortController();

    return new Stream(iterator, controller);
  }

  initParams() {
    return {
      model: this.options.modelName.value,
      temperature: this.options.temperature.value,
    };
  }

  async request(messages: BaseChatMessageLike[]) {
    const credentials = this.options.credentials;
    // console.log("straico credentials", credentials)
    if (!credentials?.apiKey) {
      throw new Error("API key is required");
    }

    const newMessages = await this.convertMessagesToStraicoMessages(messages);
    console.log("newMessages", newMessages);
    const images = newMessages
      .map((message) => {
        return message.images;
      })
      .flat();
    console.log("images", images);

    const lastMessage = newMessages.pop();
    const userInput = lastMessage?.text.text();

    const history = newMessages
      .map((message) => {
        return `${message.text.role}: ${message.text.text()}`;
      })
      .join("\n");

    const prompt = `history messages:\n${history}\n\nuser input:\n${userInput}`;

    var data = JSON.stringify({
      models: [this.options.modelName.value],
      message: prompt,
      temperature: this.options.temperature.value,
      images: images,
    });

    // console.log("data", data)

    var config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.straico.com/v1/prompt/completion",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      data: data,
    };

    // console.log("config", JSON.stringify(config))

    try {
      const response = await axios(config);
      const modelResponse =
        response.data.data.completions[this.options.modelName.value];
      const modelResponseContent =
        modelResponse.completion.choices[0].message.content;
      console.log(modelResponseContent);
      return modelResponseContent;
    } catch (error) {
      console.log(error);
    }
  }

  private async convertMessageToStraicoMessage(
    message: BaseChatMessageLike,
  ): Promise<{ text: BaseChatMessage; images: string[] }> {
    let role = message.role;

    if (typeof message.content === "string") {
      return {
        text: new BaseChatMessage(role, [
          ChatMessageContent.text(message.content),
        ]),
        images: [],
      };
    } else {
      const content = message.content
        .filter((item) => {
          return item.type === "text" || item.type === "search_result_list";
        })
        .map((item) => {
          if (item.type === "search_result_list") {
            return JSON.stringify(item.items);
          } else {
            return item.text;
          }
        });

      const images = message.content
        .filter((item) => {
          return item.type === "image_url";
        })
        .map(async (item) => {
          const url = item.image_url.url.replace("file://", "");
          if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
          } else {
            const fileUrl = await this.uploadFile(url);
            return fileUrl;
          }
        });
      const files = await Promise.all(images);
      return {
        text: new BaseChatMessage(role, [
          ChatMessageContent.text(content.join("\n")),
        ]),
        images: files,
      };
    }
  }

  private async convertMessagesToStraicoMessages(
    messages: BaseChatMessageLike[],
  ): Promise<{ text: BaseChatMessage; images: string[] }[]> {
    let newMessages = messages.map(
      async (message) => await this.convertMessageToStraicoMessage(message),
    );
    return await Promise.all(newMessages);
  }

  private async uploadFile(fileUrl: string): Promise<string> {
    return "";
    var data = new FormData();
    const file = createReadStream(fileUrl.replaceAll("file://", ""));
    data.append("file", file);

    var config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.straico.com/v0/file/upload",
      headers: {
        Authorization: `Bearer ${this.options.credentials?.apiKey}`,
        "Content-Type": "multipart/form-data",
        ...data.getHeaders(),
      },
      data: data,
    };

    try {
      const response = await axios(config);
      return response.data.data.url;
    } catch (error) {
      console.log(error);
      return "";
    }
  }
}
