import { DropdownListCache, ListCache, RequestOptions } from "@enconvo/api"

const models: ListCache.ListItem[] = [
    {
      "title": "Deepseek V3",
      "value": "deepseek-chat",
      "context": 64000,
      "inputPrice": 0.00014,
      "outputPrice": 0.00028,
      "toolUse": true
    },
    {
      "title": "Deepseek R1",
      "value": "deepseek-reasoner",
      "context": 64000,
      "inputPrice": 0.00014,
      "outputPrice": 0.00028,
      "sequenceContentDisable": true,
      "systemMessageEnable": false
    }
  ]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(options: RequestOptions): Promise<ListCache.ListItem[]> {
    // console.log("fetchModels", url, api_key, type)
    try {

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

    const models = await modelCache.getList({
        ...options,
        input_text: 'refresh'
    })

    return JSON.stringify(models)
}
