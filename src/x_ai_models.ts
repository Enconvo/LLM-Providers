import { ListCache, RequestOptions } from "@enconvo/api"


const models: ListCache.ListItem[] = [
    {
        title: "grok-3-beta",
        value: "grok-3-latest",
        context: 131072,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: false,
    },
    {
        title: "grok-3-fast-beta",
        value: "grok-3-fast-latest",
        context: 131072,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: false,
    },
    {
        title: "grok-3-mini-beta",
        value: "grok-3-mini-latest",
        context: 131072,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: false,
    },
    {
        title: "grok-3-mini-fast-beta",
        value: "grok-3-mini-fast-latest",
        context: 131072,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: false,
    },
    {
        title: "grok-beta",
        value: "grok-beta",
        context: 131072,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: false,
    },
    {
        title: "grok-vision-beta",
        value: "grok-vision-beta",
        context: 8192,
        inputPrice: 5.00,
        outputPrice: 15.00,
        toolUse: true,
        visionEnable: true,
    },
    {
        title: "grok-2-vision-1212",
        value: "grok-2-vision-1212",
        context: 32768,
        inputPrice: 2.00,
        outputPrice: 10.00,
        toolUse: true,
        visionEnable: true,
    },
    {
        title: "grok-2-1212",
        value: "grok-2-1212",
        context: 131072,
        inputPrice: 2.00,
        outputPrice: 10.00,
        toolUse: true,
        visionEnable: false,
    }
]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
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
    options.api_key = options.apiKey


    let url
    url = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)
    return JSON.stringify(models)
}
