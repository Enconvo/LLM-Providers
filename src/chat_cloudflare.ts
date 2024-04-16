import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";

export default function main(options: any) {
    console.log("Options: ", options);

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

