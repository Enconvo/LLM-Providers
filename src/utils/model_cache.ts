import { environment, LLMProvider } from "@enconvo/api"
import fs from 'fs'

export class ModelCache {

    fetchModels: ModelCache.fetchModelsFunc

    constructor(fetchModels: ModelCache.fetchModelsFunc) {
        this.fetchModels = fetchModels
    }


    /**
     * Updates the local cache with fresh model data
     * @param modelCachePath - Path to cache file
     * @param url - API endpoint URL
     * @param api_key - API authentication key
     * @returns Promise<ModelOutput[]> - Array of cached model data
     */

    async updateModelsCache(modelCachePath: string, url: string, api_key: string, type: string): Promise<ModelCache.ModelOutput[]> {
        try {
            const models = await this.fetchModels(url, api_key, type)
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
    async getModelsCache({ input_text, url, api_key, type }: { input_text: string, url: string, api_key: string, type: string }): Promise<ModelCache.ModelOutput[]> {
        const modelCachePath = this.getModelCachePath()
        // console.log("modelCachePath", modelCachePath)

        // Force refresh or create new cache if it doesn't exist
        if (!fs.existsSync(modelCachePath) || input_text === 'refresh') {
            return await this.updateModelsCache(modelCachePath, url, api_key, type)
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
            // console.log("shouldUpdate", shouldUpdate)

            if (shouldUpdate) {
                this.updateModelsCache(modelCachePath, url, api_key, type).catch(err =>
                    console.error('Background cache update failed:', err)
                );
            }
            return models
        } catch (error) {
            console.error('Error reading cache:', error)
            return await this.updateModelsCache(modelCachePath, url, api_key, type)
        }
    }

    /**
     * Gets the path for the model cache file
     * @returns string - Full path to cache file
     */
    getModelCachePath(): string {
        const modelCacheDir = `${environment.cachePath}models`
        if (!fs.existsSync(modelCacheDir)) {
            fs.mkdirSync(modelCacheDir, { recursive: true })
        }
        return `${modelCacheDir}/${environment.commandName}.json`
    }
}

export namespace ModelCache {
    export type ModelOutput = LLMProvider.LLMOptions['modelName']
    export type fetchModelsFunc = (url: string, api_key: string, type: string) => Promise<ModelOutput[]>
}