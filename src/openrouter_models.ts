import { ListCache, RequestOptions } from '@enconvo/api'
import axios from 'axios'

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    try {
        // Using axios to fetch data from the API
        const resp = await axios.get(options.url)

        if (resp.status !== 200) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = resp.data.data
        const models = data
            .map((model: any) => ({
                title: model.name,
                value: model.id,
                context: model.context_length,
                inputPrice: model.pricing.prompt,
                outputPrice: model.pricing.completion,
                toolUse: false,
                // toolUse: model.id.includes('openai/'),
                visionEnable: model.architecture.modality === 'text+image->text'
            }))

        // console.log("Total models fetched:", result)
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
    options.api_key = options.apiKey

    options.url = "https://openrouter.ai/api/v1/models"

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)

    return JSON.stringify(models)
}
