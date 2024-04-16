import { ChatAnthropic } from "@langchain/anthropic";

export default function main(options: any): ChatAnthropic {
    // change options.temperature to number

    options.temperature = Number(options.temperature.value);
    options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

    const modelOptions = options.modelName
    const modelName = modelOptions.value
    options.modelName = modelName;

    let config: any = {
        // defaultHeaders: options.headers
    }

    return new ChatAnthropic({
        ...options,
        clientOptions: config
    });
}

