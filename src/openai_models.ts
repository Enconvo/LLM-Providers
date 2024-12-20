import { DropdownListCache } from '@enconvo/api'
import { openai_models_data } from './utils/openai_models_data.ts'




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
            if (item.value) {
                return item
            }

            const model = openai_models_data.find((model: any) => model.value === (item.value || item.id))

            const context = model?.context || 8000
            const toolUse = model?.toolUse || false
            const visionEnable = model?.visionEnable || false
            const modelName = model?.value || item.id

            const systemMessageEnable = (!modelName.includes('o1-'))

            return {
                title: model?.title || item.id,
                value: modelName,
                context: context,
                inputPrice: model?.inputPrice || 0,
                outputPrice: model?.outputPrice || 0,
                toolUse: toolUse,
                visionEnable: visionEnable,
                systemMessageEnable: systemMessageEnable
            }

        }).filter((item: any) => {
            if (item.value.includes('embedding')
                || item.value.includes('dall')
                || item.value.includes('whisper')
                || item.value.includes('babbage')
                || item.value.includes('davinci')
                || item.value.includes('audio')
                || item.value.includes('realtime')
                || item.value.includes('omni-moderation')
                || item.value.includes('tts')) {
                return false
            }
            return true
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
