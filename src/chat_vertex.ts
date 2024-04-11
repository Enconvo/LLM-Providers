
import { ChatVertexAI } from "@langchain/google-vertexai";

export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);

    const model = new ChatVertexAI({
        // modelName: 'claude-3-sonnet@20240229'
        ...options,
        authOptions: {
            projectId: options.project_Id,
        }
    })

    return model
}

