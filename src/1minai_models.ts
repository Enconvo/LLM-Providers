import { ListCache, RequestOptions } from '@enconvo/api'

/**
 * 1min AI models data with capabilities and context limits
 */
const minai_models_data = [
    // GPT-4.1 Series Models
    {
        value: "gpt-4.1",
        title: "GPT-4.1",
        context: 1047576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gpt-4.1-mini",
        title: "GPT-4.1 Mini",
        context: 1047576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gpt-4.1-nano",
        title: "GPT-4.1 Nano",
        context: 1047576,
        toolUse: true,
        visionEnable: true
    },
    // OpenAI Models
    {
        value: "o3-mini",
        title: "OpenAI o3-mini",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "o1-preview",
        title: "OpenAI o1 Preview",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "o1-mini",
        title: "OpenAI o1 Mini",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "gpt-4o",
        title: "GPT-4o",
        context: 128000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gpt-4o-mini",
        title: "GPT-4o Mini",
        context: 128000,
        toolUse: true,
        visionEnable: true
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

    // Claude Models - Latest versions (4.x and 3.7)
    {
        value: "claude-opus-4-1-20250805",
        title: "Claude Opus 4.1",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-opus-4-20250514",
        title: "Claude Opus 4",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-sonnet-4-20250514",
        title: "Claude Sonnet 4",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-7-sonnet-20250219",
        title: "Claude Sonnet 3.7",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    // Claude Models - 3.5 series
    {
        value: "claude-3-5-sonnet-20241022",
        title: "Claude Sonnet 3.5 (New)",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-5-haiku-20241022",
        title: "Claude Haiku 3.5",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-5-sonnet-20240620",
        title: "Claude Sonnet 3.5 (Old)",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    // Claude Models - 3.0 series
    {
        value: "claude-3-opus-20240229",
        title: "Claude Opus 3",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-sonnet-20240229",
        title: "Claude 3 Sonnet",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "claude-3-haiku-20240307",
        title: "Claude Haiku 3",
        context: 200000,
        toolUse: true,
        visionEnable: true
    },

    // Google Models - Gemini 2.5 Series
    {
        value: "gemini-2.5-pro-preview-03-25",
        title: "Gemini 2.5 Pro Preview 03-25",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-preview-05-20",
        title: "Gemini 2.5 Flash Preview 05-20",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash",
        title: "Gemini 2.5 Flash",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-lite-preview-06-17",
        title: "Gemini 2.5 Flash-Lite Preview 06-17",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-pro-preview-05-06",
        title: "Gemini 2.5 Pro Preview 05-06",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-pro-preview-06-05",
        title: "Gemini 2.5 Pro Preview",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-pro",
        title: "Gemini 2.5 Pro",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-lite",
        title: "Gemini 2.5 Flash-Lite",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-preview-native-audio-dialog",
        title: "Gemini 2.5 Flash Preview Native Audio Dialog",
        context: 131072,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-exp-native-audio-thinking-dialog",
        title: "Gemini 2.5 Flash Exp Native Audio Thinking Dialog",
        context: 131072,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-live-2.5-flash-preview",
        title: "Gemini Live 2.5 Flash Preview",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-live-preview",
        title: "Gemini 2.5 Flash Live Preview",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.5-flash-preview-tts",
        title: "Gemini 2.5 Flash Preview TTS",
        context: 8192,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.5-pro-preview-tts",
        title: "Gemini 2.5 Pro Preview TTS",
        context: 8192,
        toolUse: false,
        visionEnable: true
    },
    // Google Models - Gemini 2.0 Series
    {
        value: "gemini-2.0-flash-exp",
        title: "Gemini 2.0 Flash Experimental",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash",
        title: "Gemini 2.0 Flash",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-001",
        title: "Gemini 2.0 Flash 001",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-exp-image-generation",
        title: "Gemini 2.0 Flash (Image Generation) Experimental",
        context: 1048576,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-lite-001",
        title: "Gemini 2.0 Flash-Lite 001",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-lite",
        title: "Gemini 2.0 Flash-Lite",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-preview-image-generation",
        title: "Gemini 2.0 Flash Preview Image Generation",
        context: 32768,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-lite-preview-02-05",
        title: "Gemini 2.0 Flash-Lite Preview 02-05",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-lite-preview",
        title: "Gemini 2.0 Flash-Lite Preview",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-pro-exp",
        title: "Gemini 2.0 Pro Experimental",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-pro-exp-02-05",
        title: "Gemini 2.0 Pro Experimental 02-05",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-thinking-exp-01-21",
        title: "Gemini 2.0 Flash Thinking Experimental 01-21",
        context: 1048576,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-thinking-exp",
        title: "Gemini 2.0 Flash Thinking Experimental",
        context: 1048576,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-thinking-exp-1219",
        title: "Gemini 2.0 Flash Thinking Experimental 1219",
        context: 1048576,
        toolUse: false,
        visionEnable: true
    },
    {
        value: "gemini-2.0-flash-live-001",
        title: "Gemini 2.0 Flash Live 001",
        context: 131072,
        toolUse: true,
        visionEnable: true
    },
    // Google Models - Other Gemini Series
    {
        value: "gemini-exp-1206",
        title: "Gemini Experimental 1206",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "learnlm-2.0-flash-experimental",
        title: "LearnLM 2.0 Flash Experimental",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    // Google Models - Gemma Series
    {
        value: "gemma-3-1b-it",
        title: "Gemma 3 1B",
        context: 32768,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemma-3-4b-it",
        title: "Gemma 3 4B",
        context: 32768,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemma-3-12b-it",
        title: "Gemma 3 12B",
        context: 32768,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemma-3-27b-it",
        title: "Gemma 3 27B",
        context: 131072,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemma-3n-e4b-it",
        title: "Gemma 3n E4B",
        context: 8192,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemma-3n-e2b-it",
        title: "Gemma 3n E2B",
        context: 8192,
        toolUse: true,
        visionEnable: true
    },
    // Google Models - Gemini 1.x Series
    {
        value: "gemini-1.5-flash",
        title: "Gemini 1.5 Flash",
        context: 1048576,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-1.5-pro",
        title: "Gemini 1.5 Pro",
        context: 2097152,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "gemini-1.0-pro",
        title: "Gemini 1.0 Pro",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },

    // Mistral Models
    {
        value: "mistral-large-latest",
        title: "Mistral Large",
        context: 128000,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "mistral-small-latest",
        title: "Mistral Small",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "mistral-nemo",
        title: "Mistral Nemo",
        context: 128000,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "pixtral-12b",
        title: "Pixtral 12B",
        context: 128000,
        toolUse: true,
        visionEnable: true
    },
    {
        value: "open-mixtral-8x22b",
        title: "Mixtral 8x22B",
        context: 65536,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "open-mixtral-8x7b",
        title: "Mixtral 8x7B",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "open-mistral-7b",
        title: "Mistral 7B",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },

    // Meta Models
    {
        value: "meta/meta-llama-3.1-405b-instruct",
        title: "Meta Llama 3.1 405B",
        context: 131072,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "meta/meta-llama-3-70b-instruct",
        title: "Meta Llama 3 70B",
        context: 8192,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "meta/llama-2-70b-chat",
        title: "Meta Llama 2 70B Chat",
        context: 4096,
        toolUse: false,
        visionEnable: false
    },

    // Other Models
    {
        value: "command",
        title: "Cohere Command",
        context: 128000,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "deepseek-chat",
        title: "DeepSeek Chat",
        context: 32768,
        toolUse: true,
        visionEnable: false
    },
    {
        value: "grok-2",
        title: "Grok-2",
        context: 131072,
        toolUse: true,
        visionEnable: true
    }
]

/**
 * Fetches models from 1min AI API or returns static model list
 * @param options - Request options containing URL and API key
 * @returns Promise<ListCache.ListItem[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    const { url, api_key } = options

    // If no API details provided, return static model list
    if (!url || !api_key) {
        return minai_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))
    }

    try {
        // 1min AI doesn't have a standard /models endpoint like OpenAI
        // We'll use the static model list as they don't provide a dynamic model list endpoint
        // The documentation shows fixed models available on their platform

        return minai_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))

    } catch (error) {
        console.error('Failed to fetch 1min AI models:', error)
        // Return static models as fallback
        return minai_models_data.map(model => ({
            value: model.value,
            title: model.title,
            context: model.context,
            toolUse: model.toolUse,
            visionEnable: model.visionEnable
        }))
    }
}

export default fetchModels
export { minai_models_data }