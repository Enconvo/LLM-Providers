import { ListCache, RequestOptions } from '@enconvo/api'

/**
 * Aimagicx models data with capabilities and context limits
 */
const aimagicx_models_data = [
    {
        value: "4o-mini",
        title: "GPT-4o Mini",
        context: 128000,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "gpt-4",
        title: "GPT-4",
        context: 8192,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "gpt-4-turbo",
        title: "GPT-4 Turbo",
        context: 128000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gpt-3.5-turbo",
        title: "GPT-3.5 Turbo",
        context: 16385,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "claude-3-sonnet",
        title: "Claude 3 Sonnet",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-haiku",
        title: "Claude 3 Haiku",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-pro",
        title: "Gemini Pro",
        context: 32768,
        toolUse: true,
        visionEnable: true
    }
]

/**
 * Fetches models from Aimagicx API or returns static model list
 * @param options - Request options containing URL and API key
 * @returns Promise<ListCache.ListItem[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    const { url, api_key } = options
    
    // If no API details provided, return static model list
    if (!url || !api_key) {
        return aimagicx_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))
    }

    try {
        const response = await fetch(`${url}/models`, {
            headers: {
                'Authorization': `Bearer ${api_key}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            // Fallback to static models if API fails
            console.warn(`Aimagicx models API failed with status ${response.status}, using static models`)
            return aimagicx_models_data.map(model => ({
                value: model.value,
                title: model.title,
                context: model.context,
                toolUse: model.toolUse,
                visionEnable: model.visionEnable
            }))
        }

        const data = await response.json()
        
        // Process API response and merge with static data for capabilities
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((apiModel: any) => {
                const staticModel = aimagicx_models_data.find(
                    model => model.value === apiModel.id || model.value === apiModel.value
                )
                
                return {
                    value: apiModel.id || apiModel.value,
                    title: apiModel.name || staticModel?.title || apiModel.id,
                    context: staticModel?.context || 8000,
                    toolUse: staticModel?.toolUse || false,
                    visionEnable: staticModel?.visionEnable || false
                }
            })
        }

        // Fallback to static models if API response format is unexpected
        return aimagicx_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))

    } catch (error) {
        console.error('Failed to fetch Aimagicx models:', error)
        // Return static models as fallback
        return aimagicx_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))
    }
}

export default fetchModels
export { aimagicx_models_data }