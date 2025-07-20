import { ListCache, RequestOptions } from "@enconvo/api"



/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    // console.log("fetchModels", url, api_key, type)
    try {
        if (!options.url || !options.api_key) {
            throw new Error("URL and API key are required")
        }
        const resp = await fetch(options.url, {
            headers: {
                'Authorization': `Bearer ${options.api_key}`
            }
        })

        if (!resp.ok) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = await resp.json()
        // console.log("302_ai_models data", JSON.stringify(data.data, null, 2))
        const result = data.data.filter((item: any) => !item.id.includes('whisper')).map((item: any) => {
            const context = item.max_completion_tokens || 8000
            const visionEnable = item.supports_image_input || false
            // Check if model supports tool use based on model ID
            // llama-3.3-70b-versatile and llama-3.1-8b-instant support tool use
            const toolUse = item.supported_tools || false
            return {
                title: item.title || item.id,
                value: item.value || item.id,
                context: context,
                inputPrice: item.inputPrice || 0,
                outputPrice: item.outputPrice || 0,
                toolUse: toolUse,
                visionEnable: visionEnable,
                visionImageCountLimit: 1,
                systemMessageEnable: !visionEnable
            }
        })

        // console.log("Total models fetched:", result)
        return result

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
    const credentials = options.credentials
    console.log("302_ai_models credentials", credentials)
    options.api_key = credentials.apiKey

    const url = credentials.baseUrl.endsWith('/') ? credentials.baseUrl : `${credentials.baseUrl}/`
    options.url = `${url}models`


    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)
    return JSON.stringify(models)
}
