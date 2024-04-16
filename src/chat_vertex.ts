
import { ChatVertexAI } from "@langchain/google-vertexai";

export default function main(options: any) {
    options.temperature = Number(options.temperature.value);

    const modelOptions = options.modelName
    const modelName = modelOptions.value
    options.model = modelName;


    const model = new ChatVertexAI({
        // modelName: 'claude-3-sonnet@20240229'
        ...options,
        authOptions: {
            projectId: options.project_id,
        }
    })

    return model
}

