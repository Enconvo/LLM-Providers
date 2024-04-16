import { ChatCohere } from "@langchain/cohere";


export default function main(options: any) {
    // change options.temperature to number

    options.temperature = Number(options.temperature.value);

    const modelOptions = options.model
    const modelName = modelOptions.value
    options.model = modelName;

    const model = new ChatCohere({
        ...options
    })

    return model
}

