import { ChatAnthropic } from "@langchain/anthropic";

export default function main(options: any): ChatAnthropic {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    // streaming to boolean
    options.stream = options.stream === "true";

    let config: any = {
        // defaultHeaders: options.headers
    }

    return new ChatAnthropic({
        ...options,
        clientOptions: config
    });
}

