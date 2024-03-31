import { ChatCloudflareWorkersAI } from "@langchain/community/chat_models/cloudflare_workersai";
export default function main(options: any) {
    // streaming to boolean
    options.streaming = options.streaming === "true";

    const model = new ChatCloudflareWorkersAI({
        model: options.modelName, // Default value
        cloudflareAccountId: options.account_id,
        cloudflareApiToken: options.apiKey,
        ...options,
    });

    return model;

}

