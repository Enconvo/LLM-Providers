import { DropdownListCache, ListCache, RequestOptions } from "@enconvo/api"
import { GoogleGenAI } from "@google/genai";


/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    try {
        const google = new GoogleGenAI({ apiKey: options.api_key });
        const pager = await google.models.list()
        const models: ListCache.ListItem[] = []
        for await (const model of pager) {
            console.log(model)
            if (model.supportedActions?.some(action => action === 'generateContent' || action === 'bidiGenerateContent')) {
                const isGemini15 = model.name?.includes('gemini-1.5')
                const isGemini10 = model.name?.includes('gemini-1.0')
                const isDeprecatedModel = model.name?.includes('gemini-pro-vision')
                if (isGemini15 || isGemini10 || isDeprecatedModel) {
                    continue
                }
                const isThinking = model.name?.includes('thinking')
                const isImageGeneration = model.name?.includes('image-generation')
                const isTTS = model.name?.includes('tts')
                models.push({
                    title: model.displayName || '',
                    value: model.name?.replace('models/', '') || '',
                    context: model.inputTokenLimit,
                    maxTokens: model.outputTokenLimit,
                    visionEnable: true,
                    audioEnable: true,
                    toolUse: !isThinking && !isImageGeneration && !isTTS
                })
            }
        }

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

    const modelCache = new ListCache(fetchModels)

    const credentials = options.credentials
    console.log("gemini models credentials", credentials)

    const models = await modelCache.getList({
        ...options,
        api_key: credentials.apiKey
    })

    return JSON.stringify(models)
}
