import { DropdownListCache, environment } from "@enconvo/api"
import fs from 'fs'


// ModelOutput interface representing the processed model data structure
interface ModelOutput {
    title: string           // Display name of the model
    value: string          // Model ID
    context: number        // Maximum context length
    inputPrice: number     // Price per token for input
    outputPrice: number    // Price per token for output
    toolUse: boolean       // Whether model supports tool use
    visionEnable: boolean  // Whether model supports vision/image processing
}

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url: string, api_key: string, type: string): Promise<ModelOutput[]> {
    try {
        if (type) {
            url = `${url}?type=${type}`
        }
        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        })

        if (!resp.ok) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = await resp.json()
        // console.log("Total models fetched:", data.length)
        return data

    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

/**
 * Updates the local cache with fresh model data



/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const options = await req.json()

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache(options)

    return JSON.stringify(models)
}
