import { DropdownListCache } from "@enconvo/api"

const models: DropdownListCache.ModelOutput[] = [
    {
        "title": "Gemini 2.0 Flash Exp",
        "value": "gemini-2.0-flash-exp",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 2.0 Flash Thinking",
        "value": "gemini-2.0-flash-thinking-exp-1219",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini Exp 1206",
        "value": "gemini-exp-1206",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Flash-8B",
        "value": "gemini-1.5-flash-8b",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Flash 002",
        "value": "gemini-1.5-flash-002",
        "context": 1048576,
        "visionEnable": true
    },
    {
        "title": "Gemini 1.5 Pro 002",
        "value": "gemini-1.5-pro-002",
        "context": 2097152,
        "visionEnable": true
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
