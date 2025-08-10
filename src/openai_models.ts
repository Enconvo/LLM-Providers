import { ListCache, RequestOptions } from '@enconvo/api'
import { openai_models_data } from './utils/openai_models_data.ts'
import axios from 'axios'




/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    const { url, api_key } = options
    console.log("openai models options", url, api_key)
    if (!url || !api_key) {
        return []
    }
    const resp = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${api_key}`
        }
    })

    if (resp.status !== 200) {
        throw new Error(`API request failed with status ${resp.status}`)
    }

    const data = resp.data
    // console.log("data", data)
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
            ...model,
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

    return result
}


/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const options = await req.json()

    const credentials = options.credentials

    // console.log("openai models credentials", credentials)

    options.api_key = credentials?.apiKey

    let url
    url = credentials.baseUrl?.endsWith('/') ? credentials?.baseUrl : `${credentials?.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)

    return JSON.stringify(models)
}
