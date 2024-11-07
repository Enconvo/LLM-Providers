import { environment } from "@enconvo/api"
import fs from 'fs'


// ModelOutput interface representing the processed model data structure
interface ModelOutput {
    title: string           // Display name of the model
    value: string          // Model ID
    context: number        // Maximum context length
    inputPrice: number     // Price per token for input
    outputPrice: number    // Price per token for output
    toolUse: boolean       // Whether model supports tool use
    visionEnable: boolean  // Whether model supports vision/image processing
}

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url: string, api_key: string, type: string): Promise<ModelOutput[]> {
    try {
        if (type) {
            url = `${url}?type=${type}`
        }
        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        })

        if (!resp.ok) {
            throw new Error(`API request failed with status ${resp.status}`)
        }

        const data = await resp.json()
        console.log("Total models fetched:", data.length)
        return data

    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

/**
 * Updates the local cache with fresh model data
 * @param modelCachePath - Path to cache file
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of cached model data
 */
async function updateModelsCache(modelCachePath: string, url: string, api_key: string, type: string): Promise<ModelOutput[]> {
    try {
        const models = await fetchModels(url, api_key, type)
        if (models.length > 0) {
            fs.writeFileSync(modelCachePath, JSON.stringify(models, null, 2))
        }
        return models
    } catch (err) {
        console.error('Error updating models cache:', err)
        return []
    }
}

/**
 * Retrieves model data from cache or fetches fresh data if needed
 * @param options - Object containing input_text, url and api_key
 * @returns Promise<ModelOutput[]> - Array of model data
 */
async function getModelsCache({ input_text, url, api_key, type }: { input_text: string, url: string, api_key: string, type: string }): Promise<ModelOutput[]> {
    const modelCachePath = getModelCachePath()

    // Force refresh or create new cache if it doesn't exist
    if (!fs.existsSync(modelCachePath) || input_text === 'refresh') {
        return await updateModelsCache(modelCachePath, url, api_key, type)
    }

    try {
        // Return cached data and update cache in background
        const modelContent = fs.readFileSync(modelCachePath, 'utf8')
        const models = JSON.parse(modelContent)
        // Async cache update without blocking
        const stats = fs.statSync(modelCachePath);
        console.log("stats", stats.mtimeMs)
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        const shouldUpdate = stats.mtimeMs < thirtyMinutesAgo;

        if (shouldUpdate) {
            updateModelsCache(modelCachePath, url, api_key, type).catch(err =>
                console.error('Background cache update failed:', err)
            );
        }
        return models
    } catch (error) {
        console.error('Error reading cache:', error)
        return await updateModelsCache(modelCachePath, url, api_key, type)
    }
}

/**
 * Gets the path for the model cache file
 * @returns string - Full path to cache file
 */
function getModelCachePath(): string {
    const modelCacheDir = `${environment.cachePath}/models`
    if (!fs.existsSync(modelCacheDir)) {
        fs.mkdirSync(modelCacheDir, { recursive: true })
    }
    return `${modelCacheDir}/${environment.commandName}.json`
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const { options } = await req.json()
    console.log("options", options)
    const models = await getModelsCache(options)
    return JSON.stringify(models)
}
