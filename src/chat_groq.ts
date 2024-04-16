import { ChatGroq } from "@langchain/groq";

export default function main(options: any) {
    options.temperature = Number(options.temperature.value);

    const modelOptions = options.modelName
    const modelName = modelOptions.value
    options.modelName = modelName;


    const model = new ChatGroq(options);

    return model;
}

