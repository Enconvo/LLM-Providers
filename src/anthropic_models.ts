import { ListCache, RequestOptions } from '@enconvo/api'

import Anthropic from '@anthropic-ai/sdk';



/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    const credentials = options.credentials

    const credentialsType = credentials?.credentials_type?.value

    if (credentialsType === 'oauth2' && (!credentials?.access_token)) {
        return []
    }

    if (credentialsType === 'apiKey' && (!credentials?.anthropicApiKey)) {
        return []
    }

    const anthropic = new Anthropic({
        apiKey: credentials?.anthropicApiKey,
        authToken: credentials?.access_token,
        baseURL: credentials?.anthropicApiUrl,
        defaultHeaders: credentialsType === 'oauth2' ? {
            'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14',
        } : {}
    });

    const models = await anthropic.models.list()
    // console.log("anthropic models", models)

    let result: ListCache.ListItem[] = []
    for await (const model of models.iterPages()) {
        const items = model.data.map((item) => {
            // Default values for all Claude models
            const context = 200000
            const toolUse = true
            const visionEnable = true
            let maxTokens = 8192
            let inputPrice = 1
            let outputPrice = 1
            let speed = 3 // Default speed rating (1-5, 5 being fastest)
            let intelligence = 3 // Default intelligence rating (1-5, 5 being highest)

            // Configure model-specific properties based on model ID
            if (item.id.includes('claude-opus-4-1')) {
                // Claude Opus 4.1 - Most capable model
                maxTokens = 32000
                inputPrice = 15
                outputPrice = 75
                speed = 3 // Moderately fast
                intelligence = 5 // Highest intelligence
            } else if (item.id.includes('claude-opus-4')) {
                // Claude Opus 4 - Previous flagship model
                maxTokens = 32000
                inputPrice = 15
                outputPrice = 75
                speed = 3 // Moderately fast
                intelligence = 5 // Very high intelligence
            } else if (item.id.includes('claude-sonnet-4')) {
                // Claude Sonnet 4 - High-performance model
                maxTokens = 64000
                inputPrice = 3
                outputPrice = 15
                speed = 4 // Fast
                intelligence = 4 // High intelligence
            } else if (item.id.includes('claude-3-7-sonnet')) {
                // Claude Sonnet 3.7 - High-performance with extended thinking
                maxTokens = 64000
                inputPrice = 3
                outputPrice = 15
                speed = 4 // Fast
                intelligence = 4 // High intelligence with extended thinking
            } else if (item.id.includes('claude-3-5-sonnet')) {
                // Claude Sonnet 3.5 - Previous intelligent model
                maxTokens = 8192
                inputPrice = 3
                outputPrice = 15
                speed = 4 // Fast
                intelligence = 4 // High intelligence
            } else if (item.id.includes('claude-3-5-haiku')) {
                // Claude Haiku 3.5 - Fastest model
                maxTokens = 8192
                inputPrice = 0.8
                outputPrice = 4
                speed = 5 // Fastest
                intelligence = 3 // Intelligence at blazing speeds
            } else if (item.id.includes('claude-3-opus')) {
                // Claude Opus 3 - Previous high-capability model
                maxTokens = 32000
                inputPrice = 15
                outputPrice = 75
                speed = 3 // Moderately fast
                intelligence = 4 // High intelligence
            } else if (item.id.includes('claude-3-haiku')) {
                // Claude Haiku 3 - Fast and compact model
                maxTokens = 4096
                inputPrice = 0.25
                outputPrice = 1.25
                speed = 4 // Fast
                intelligence = 2 // Quick and accurate targeted performance
            }

            return {
                title: item.display_name,
                value: item.id,
                context: context,
                inputPrice: inputPrice,
                outputPrice: outputPrice,
                toolUse: toolUse,
                visionEnable: visionEnable,
                maxTokens: maxTokens,
                speed: speed,
                intelligence: intelligence,
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

    const modelCache = new ListCache(fetchModels)

    const models = await modelCache.getList(options)

    return JSON.stringify(models)
}
