import { ListCache, RequestOptions } from '@enconvo/api'

import Anthropic from '@anthropic-ai/sdk';



/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    if (!options.url || !options.api_key) {
        return []
    }

    const anthropic = new Anthropic({
        apiKey: options.api_key, // defaults to process.env["ANTHROPIC_API_KEY"]
        baseURL: options.url
    });

    const models = await anthropic.models.list()

    let result: ListCache.ListItem[] = []
    for await (const model of models.iterPages()) {
        const items = model.data.map((item) => {
            const context = 200000
            const toolUse = true
            const visionEnable = true
            let maxTokens = 8192
            let inputPrice = 1
            let outputPrice = 0
            if (item.id.includes('claude-opus-4')) {
                maxTokens = 32000
                inputPrice = 15
                outputPrice = 75
            } else if (item.id.includes('claude-sonnet-4')) {
                maxTokens = 32000
                inputPrice = 3
                outputPrice = 15
            } else if (item.id.includes('claude-3-7-sonnet')) {
                maxTokens = 64000
                inputPrice = 3
                outputPrice = 15
            } else if (item.id.includes('claude-3-5-sonnet')) {
                inputPrice = 3
                outputPrice = 15
            } else if (item.id.includes('claude-3-5-haiku')) {
                inputPrice = 0.8
                outputPrice = 4
            } else if (item.id.includes('claude-3-opus')) {
                inputPrice = 15
                outputPrice = 75
            } else if (item.id.includes('claude-3-haiku')) {
                inputPrice = 0.25
                outputPrice = 1.5
            }

            return {
                title: item.display_name,
                value: item.id,
                context: context,
                inputPrice: 0,
                outputPrice: 0,
                toolUse: toolUse,
                visionEnable: visionEnable,
                maxTokens: maxTokens,
            }
        })

        result.push(...items)
    }

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
    console.log("anthropic models credentials", credentials)
    options.api_key = credentials.anthropicApiKey
    options.url = credentials.anthropicApiUrl

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)

    return JSON.stringify(models)
}
