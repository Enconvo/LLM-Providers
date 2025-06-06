import { DropdownListCache } from "@enconvo/api"


const models: DropdownListCache.ModelOutput[] = [
    {
        title: "DeepSeek-R1-Distill-Llama-70B",
        value: "DeepSeek-R1-Distill-Llama-70B",
        context: 64000,
    },    {
        title: "DeepSeek-R1",
        value: "DeepSeek-R1",
        context: 64000,
    },
    {
        title: "Llama-3.1-Tulu-3-405B",
        value: "Llama-3.1-Tulu-3-405B",
        context: 16384,
    },
    {
        title: "Qwen2.5 Coder 32B",
        value: "Qwen2.5-Coder-32B-Instruct",
        context: 8192,
    },
    {
        title: "Qwen2.5 72B",
        value: "Qwen2.5-72B-Instruct",
        context: 8192,
    },
    {
        title: "QwQ 32B Preview",
        value: "QwQ-32B-Preview",
        context: 8192,
    },
    {
        title: "Llama 3.3 70B",
        value: "Meta-Llama-3.3-70B-Instruct",
        context: 4096,
    },
    {
        title: "Llama-3.2-11B-Vision-Instruct",
        value: "Llama-3.2-11B-Vision-Instruct",
        context: 4096,
    },
    {
        title: "Llama-3.2-90B-Vision-Instruct",
        value: "Llama-3.2-90B-Vision-Instruct",
        context: 4096,
    },
    {
        title: "Llama 3.2 1B",
        value: "Meta-Llama-3.2-1B-Instruct",
        context: 16384,
    },
    {
        title: "Llama 3.2 3B",
        value: "Meta-Llama-3.2-3B-Instruct",
        context: 4096,
    },
    {
        title: "Llama 3.2 11B",
        value: "Llama-3.2-11B-Vision-Instruct",
        context: 4096,
    },
    {
        title: "Llama 3.2 90B",
        value: "Llama-3.2-90B-Vision-Instruct",
        context: 4096,
    },
    {
        title: "Llama 3.1 8B",
        value: "Meta-Llama-3.1-8B-Instruct",
        context: 16384,
    },
    {
        title: "Llama 3.1 70B",
        value: "Meta-Llama-3.1-70B-Instruct",
        context: 131072,
    },
    {
        title: "Llama 3.1 405B",
        value: "Meta-Llama-3.1-405B-Instruct",
        context: 16384,
    },
    {
        title: "Llama Guard 3 8B",
        value: "Meta-Llama-Guard-3-8B",
        context: 8192,
    }
]

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(url?: string, api_key?: string, type?: string): Promise<DropdownListCache.ModelOutput[]> {
    // console.log("fetchModels", url, api_key, type)
    return models
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
    const options = await req.json()
    const credentials = options.credentials
    console.log("sambanova models credentials", credentials)
    options.api_key = credentials.apiKey

    let url
    url = credentials.baseUrl.endsWith('/') ? credentials.baseUrl : `${credentials.baseUrl}/`
    url = `${url}models`

    options.url = url

    const modelCache = new DropdownListCache(fetchModels)

    const models = await modelCache.getModelsCache(options)
    return JSON.stringify(models)
}
