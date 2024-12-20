import { DropdownListCache } from "@enconvo/api"


const models: DropdownListCache.ModelOutput[] = [
    {
        "title": "Qwen-Max-Latest",
        "value": "qwen-max-latest",
        "context": 32000
    },
    {
        "title": "Qwen-Plus-Latest",
        "value": "qwen-plus-latest",
        "context": 128000
    },
    {
        "title": "Qwen-Turbo-Latest",
        "value": "qwen-turbo-latest",
        "context": 128000
    },
    {
        "title": "Qwen-VL-Max-Latest",
        "value": "qwen-vl-max-latest",
        "context": 8000,
        "visionEnable": true
    },
    {
        "title": "Qwen-VL-Max-Plus",
        "value": "qwen-vl-max-plus",
        "context": 8000,
        "visionEnable": true
    },
    {
        "title": "Qwen2.5-72B",
        "value": "qwen2.5-72b-instruct",
        "context": 128000
    },
    {
        "title": "Qwen2.5-32B",
        "value": "qwen2.5-32b-instruct",
        "context": 128000
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
        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        })

        if (!resp.ok) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = await resp.json()
        const result = data.data.map((item: any) => {
            const model = models.find((m) => {
                return m.value === item.id
            })

            const context = model?.context || 8000
            const visionEnable = model?.visionEnable || item.id.includes('-vl')
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
    options.api_key = options.openAIApiKey


    let url
    url = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache(options)
    return JSON.stringify(models)
}
