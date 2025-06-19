import { DropdownListCache, ListCache, RequestOptions } from "@enconvo/api"


/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    // console.log("fetchModels", url, api_key, type)
    try {
        const resp = await fetch(options.url, {
            headers: {
                'Authorization': `Bearer ${options.api_key}`
            }
        })

        if (!resp.ok) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = await resp.json()
        const result = data.data.filter((item: any) => item.capabilities.completion_chat).map((item: any) => {

            const context = item.max_context_length || 8000
            const visionEnable = item.capabilities.vision || false
            const toolUse = false
            // const toolUse = item.capabilities.function_calling || false
            const title = item.name || item.id
            const value = item.id
            const inputPrice = 0
            const outputPrice = 0

            return {
                title: title,
                value: value,
                context: context,
                inputPrice: inputPrice,
                outputPrice: outputPrice,
                toolUse: toolUse,
                visionEnable: visionEnable
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
    options.api_key = options.apiKey


    let url
    url = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)
    return JSON.stringify(models)
}
