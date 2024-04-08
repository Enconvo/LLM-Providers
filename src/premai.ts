import { ChatPrem } from "@langchain/community/chat_models/premai";
import Prem from '@premai/prem-sdk';
export default function main(options: any) {
    // change options.temperature to number
    options.temperature = Number(options.temperature);
    options.frequencyPenalty = Number(options.frequencyPenalty || "0.0");

    const prem = new Prem({
        apiKey: options.apiKey,
    })
    prem.models.list().then((models) => {
        console.log("models", models)
    })

    // streaming to boolean
    options.stream = options.stream === "true";

    let project_id = -1
    try {
        project_id = parseInt(options.project_id)
    } catch (error) {

    }
    const model = new ChatPrem({
        // In Node.js defaults to process.env.PREM_API_KEY
        ...options,
        // In Node.js defaults to process.env.PREM_PROJECT_ID
        project_id,
    });

    return model;


}

