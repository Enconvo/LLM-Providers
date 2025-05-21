import { DropdownListCache } from "@enconvo/api"
import { GoogleGenAI } from "@google/genai";

const models: DropdownListCache.ModelOutput[] = [
    {
        "title": "Gemini 2.5 Pro Preview 05-06",
        "value": "gemini-2.5-pro-preview-05-06",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.5 Flash Preview 04-17",
        "value": "gemini-2.5-flash-preview-04-17",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.5 Pro Preview 03-25",
        "value": "gemini-2.5-pro-preview-03-25",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.0 Flash Exp With Image Generation",
        "value": "gemini-2.0-flash-exp-image-generation",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": false
    },
    {
        "title": "Gemini 2.0 Flash",
        "value": "gemini-2.0-flash",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.0 Flash Exp",
        "value": "gemini-2.0-flash-exp",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.5 Pro Exp",
        "value": "gemini-2.5-pro-exp-03-25",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 2.0 Flash Lite",
        "value": "gemini-2.0-flash-lite",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": false
    },
    {
        "title": "Gemini 2.0 Pro Exp",
        "value": "gemini-2.0-pro-exp",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": false
    },
    {
        "title": "Gemini 2.0 Flash Thinking",
        "value": "gemini-2.0-flash-thinking-exp-01-21",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": false
    },
    {
        "title": "Gemini Exp 1206",
        "value": "gemini-exp-1206",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 1.5 Flash-8B",
        "value": "gemini-1.5-flash-8b",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 1.5 Flash 002",
        "value": "gemini-1.5-flash-002",
        "context": 1048576,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    },
    {
        "title": "Gemini 1.5 Pro 002",
        "value": "gemini-1.5-pro-002",
        "context": 2097152,
        "visionEnable": true,
        "audioEnable": true,
        "toolUse": true
    }
]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url: string, api_key: string, type: string): Promise<DropdownListCache.ModelOutput[]> {
    // console.log("fetchModels", url, api_key, type)
    try {

        const google = new GoogleGenAI({ apiKey: api_key });
        const pager = await google.models.list()
        for await (const model of pager) {
            console.log(model)
        }


        return models

    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const options = await req.json()

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache({
        ...options,
        input_text: 'refresh'
    })

    return JSON.stringify(models)
}
