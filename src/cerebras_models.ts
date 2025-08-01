import { DropdownListCache, ListCache, RequestOptions } from "@enconvo/api"
import axios from 'axios';

const models: DropdownListCache.ModelOutput[] = [
    {
        "title": "Llama 3.3 70B",
        "value": "llama-3.3-70b",
        "context": 8192,
        toolUse: true
    },
    {
        "title": "Llama 3.1 8B",
        "value": "llama3.1-8b",
        "context": 8192,
        toolUse: true
    },
    {
        "title": "Llama 3.1 70B",
        "value": "llama3.1-70b",
        "context": 8192,
        toolUse: true
    }
]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    if (!options.url) {
        return []
    }
    try {
        // Using axios to make the API request
        const resp = await axios.get(options.url, {
            headers: {
                'Authorization': `Bearer ${options.api_key}`
            }
        });

        if (resp.status !== 200) {
            throw new Error(`
                url: ${options.url}
                api_key: ${options.api_key}
                type: ${options.type}
                API request failed with status ${resp.data}`)
        }

        const data = resp.data
        const result = data.data.map((item: any) => {
            const model = models.find((m) => {
                return m.value === item.id
            })

            const context = model?.context || 8000
            const visionEnable = model?.visionEnable || false
            const toolUse = model?.toolUse || true
            const title = model?.title || item.id
            const value = model?.value || item.id
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
    
    options.api_key = credentials.apiKey

    let url
    url = credentials.baseUrl.endsWith('/') ? credentials.baseUrl : `${credentials.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)
    return JSON.stringify(models)
}
