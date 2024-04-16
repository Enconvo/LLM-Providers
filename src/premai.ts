import { ChatPrem } from "@langchain/community/chat_models/premai";
// import Prem from '@premai/prem-sdk';
export default function main(options: any) {
    // change options.temperature to number
    console.log("prem",options)
    options.temperature = Number(options.temperature.value);

    const modelOptions = options.model
    const modelName = modelOptions.value
    options.model = modelName;

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

