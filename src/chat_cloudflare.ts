import {
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";

export default function main(options: any) {
  return new ChatCloudflareWorkersProvider(options);
}

export class ChatCloudflareWorkersProvider extends LLMProvider {
  protected _call(content: LLMProvider.Params): Promise<BaseChatMessage> {
    throw new Error("Method not implemented.");
  }
  protected _stream(content: LLMProvider.Params): Promise<Stream<BaseChatMessageChunk>> {
    throw new Error("Method not implemented.");
  }


}



/**
 * 
 *     {
      "name": "chat_cloudflare",
      "title": "Cloudflare Workers AI",
      "description": "Chat with Cloudflare Workers AI, learn more : [workers-ai](https://developers.cloudflare.com/workers-ai/)",
      "icon": "cloudflare.png",
      "mode": "no-view",
      "commandType": "provider",
      "preferences": [
        {
          "name": "credentials",
          "description": "The key management provider to use",
          "type": "extension",
          "required": false,
          "default": "cloudflare",
          "extensionType": "credentials-provider",
          "extensionFilter": {
            "targetCommands": [
              "credentials|cloudflare"
            ]
          },
          "title": "Credential Provider"
        },
        {
          "name": "modelName",
          "description": "The model to generate the completion.",
          "type": "dropdown",
          "required": false,
          "title": "Model Name",
          "default": "@cf/meta/llama-2-7b-chat-int8",
          "dataProxy": "llm|cloudflare_models"
        }
      ]
    },
 */