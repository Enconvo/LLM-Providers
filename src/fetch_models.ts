import { ListCache, RequestOptions } from "@enconvo/api"




/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    let { url, api_key, type } = options
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
        return data

    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}

/**
 * Updates the local cache with fresh model data



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
