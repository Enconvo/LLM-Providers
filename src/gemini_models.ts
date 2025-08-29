import { ListCache, Preference, RequestOptions } from "@enconvo/api"
import { GoogleGenAI } from "@google/genai";


// Gemini models pricing and configuration data
const geminiModelsData: Preference.LLMModel[] = [
    // Gemini 2.5 Pro - State-of-the-art multipurpose model
    {
        title: "Gemini 2.5 Pro",
        value: "gemini-2.5-pro",
        inputPrice: 1.25, // prompts <= 200k tokens
        outputPrice: 10.00,
        speed: 3,
        intelligence: 5,
        reasoning: 5,
        type: "llm_model"
    },
    // Gemini 2.5 Flash - Hybrid reasoning model with 1M token context
    {
        title: "Gemini 2.5 Flash",
        value: "gemini-2.5-flash",
        inputPrice: 0.30, // text/image/video
        outputPrice: 2.50,
        speed: 4,
        intelligence: 4,
        reasoning: 4,
        type: "llm_model"
    },
    {
        title: "Gemini 2.5 Flash Image Preview",
        value: "gemini-2.5-flash-image-preview",
        context: 32768,
        maxTokens:32768,
        inputPrice: 100,
        outputPrice: 0.40,
        speed: 5,
        intelligence: 3,
        reasoning: 0,
        visionEnable: true,
        imageGeneration: true,
        audioEnable: false,
        toolUse: false,
        type: "llm_model"
    },
    // Gemini 2.5 Flash-Lite - Most cost effective model
    {
        title: "Gemini 2.5 Flash-Lite",
        value: "gemini-2.5-flash-lite",
        inputPrice: 0.10, // text/image/video
        outputPrice: 0.40,
        speed: 5,
        intelligence: 3,
        reasoning: 3,
        type: "llm_model"
    },
    // Gemini 2.0 Flash - Balanced multimodal model for Agents era
    {
        title: "Gemini 2.0 Flash",
        value: "gemini-2.0-flash",
        inputPrice: 0.10, // text/image/video
        outputPrice: 0.40,
        speed: 4,
        intelligence: 4,
        type: "llm_model"
    },
    // Gemini 2.0 Flash-Lite - Smallest and most cost effective
    {
        title: "Gemini 2.0 Flash-Lite",
        value: "gemini-2.0-flash-lite",
        inputPrice: 0.075,
        outputPrice: 0.30,
        speed: 5,
        intelligence: 3,
        type: "llm_model"
    },
    // Gemini 1.5 Pro - Highest intelligence with 2M token context
    {
        title: "Gemini 1.5 Pro",
        value: "gemini-1.5-pro",
        inputPrice: 1.25, // prompts <= 128k tokens
        outputPrice: 5.00,
        speed: 3,
        intelligence: 5,
        type: "llm_model"
    },
    // Gemini 1.5 Flash - Fastest multimodal with 1M token context
    {
        title: "Gemini 1.5 Flash",
        value: "gemini-1.5-flash",
        inputPrice: 0.075, // prompts <= 128k tokens
        outputPrice: 0.30,
        speed: 4,
        intelligence: 4,
        type: "llm_model"
    },
    // Gemini 1.5 Flash-8B - Smallest model for lower intelligence tasks
    {
        title: "Gemini 1.5 Flash-8B",
        value: "gemini-1.5-flash-8b",
        inputPrice: 0.0375, // prompts <= 128k tokens
        outputPrice: 0.15,
        speed: 5,
        intelligence: 3,
        type: "llm_model"
    }
];

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param options - Request options containing API key and other parameters
 * @returns Promise<ListCache.ListItem[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    try {
        const google = new GoogleGenAI({ apiKey: options.api_key });
        const pager = await google.models.list()
        const models: ListCache.ListItem[] = []
        console.log("gemini models", JSON.stringify(pager, null, 2))

        for await (const model of pager) {
            console.log(model)

            // Check if model supports content generation
            if (model.supportedActions?.some(action => action === 'generateContent' || action === 'bidiGenerateContent')) {
                // Skip deprecated and unsupported models
                const isGemini15 = model.name?.includes('gemini-1.5')
                const isGemini10 = model.name?.includes('gemini-1.0')
                const isDeprecatedModel = model.name?.includes('gemini-pro-vision')

                if (isGemini15 || isGemini10 || isDeprecatedModel) {
                    continue
                }

                // Identify special model types
                const isThinking = model.name?.includes('thinking')
                const isTTS = model.name?.includes('tts')
                const isEmbedding = model.name?.includes('embedding')

                if (isEmbedding) {
                    continue
                }

                const modelId = model.name?.replace('models/', '') || ''

                // Find matching model data or use defaults
                const modelData = geminiModelsData.find(data => modelId.includes(data.value)) || {
                    inputPrice: 0.10,
                    outputPrice: 0.40,
                    speed: 4,
                    intelligence: 3,
                    visionEnable: true,
                    audioEnable: true,
                    imageGeneration: false,
                    audioGeneration: false,
                    toolUse: true,
                    type: "llm_model"
                }

                models.push({
                    title: model.displayName || modelId,
                    value: modelId,
                    context: model.inputTokenLimit || 1000000, // Default 1M context
                    maxTokens: model.outputTokenLimit || 8192, // Default max tokens
                    visionEnable: modelData.visionEnable || true, // All Gemini models support vision
                    audioEnable: modelData.audioEnable || true, // All Gemini models support audio
                    imageGeneration: modelData.imageGeneration || false,
                    audioGeneration: modelData.audioGeneration || isTTS || false,
                    systemMessageEnable: true, // All Gemini models support system messages
                    toolUse: modelData.toolUse || !isThinking, // Thinking models don't support tools
                    speed: modelData.speed || 4,
                    intelligence: modelData.intelligence || 3,
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
    // console.log("gemini models credentials", credentials)

    const models = await modelCache.getList({
        ...options,
        api_key: credentials.apiKey
    })

    return JSON.stringify(models)
}
