import { ListCache, RequestOptions } from "@enconvo/api"

const models: ListCache.ListItem[] = [

]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    console.log("fetchModels", options.url, options.api_key, options.type)
    if (!options.url || !options.api_key || !options.type) {
        return []
    }
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
        const result = data.data[options.type].map((item: any) => {
            const model = models.find((m) => {
                return m.value === item.model
            })

            const context = model?.context || 8000
            const visionEnable = model?.visionEnable || false
            const toolUse = model?.toolUse || false
            const title = model?.title || item.name
            const value = model?.value || item.model
            const inputPrice = model?.inputPrice || 0
            const outputPrice = model?.outputPrice || 0
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
    const credentials = options.credentials
    // console.log("credentials", credentials)

    options.url = 'https://api.straico.com/v1/models'
    options.api_key = credentials.apiKey
    options.type = options.type || 'chat'

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)
    return JSON.stringify(models)
}
