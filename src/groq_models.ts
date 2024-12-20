import { DropdownListCache } from "@enconvo/api"



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
        const result = data.data.filter((item: any) => !item.id.includes('whisper')).map((item: any) => {
            const context = item.context_window || 8000
            const visionEnable = item.id.includes('vision')
            const toolUse = item.id.includes('tool-use')
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
    options.api_key = options.openAIApiKey


    let url
    url = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache(options)
    return JSON.stringify(models)
}
