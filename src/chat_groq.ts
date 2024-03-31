import { ChatGroq } from "@langchain/groq";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

    // streaming to boolean
    options.stream = options.stream === "true";

    const model = new ChatGroq(options);

    return model;
}

