import { ListCache, RequestOptions } from "@enconvo/api";

const models: ListCache.ListItem[] = [
  {
    title: "Deepseek V3",
    value: "deepseek-chat",
    context: 64000,
    inputPrice: 0.14, // Price per 1M tokens
    outputPrice: 0.28, // Price per 1M tokens
    toolUse: true,
  },
  {
    title: "Deepseek R1",
    value: "deepseek-reasoner",
    context: 64000,
    inputPrice: 0.14, // Price per 1M tokens
    outputPrice: 0.28, // Price per 1M tokens
    sequenceContentDisable: true,
    systemMessageEnable: false,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        "default": "low",
        "data": [
          {
            "title": "low",
            "value": "low",
            "description": "Favors speed and economical token usage with basic reasoning"
          },
          {
            "title": "medium",
            "value": "medium",
            "description": "Balance between speed and reasoning accuracy (default)"
          },
          {
            "title": "high",
            "value": "high",
            "description": "Favors more complete reasoning with higher token usage"
          }
        ],
      }
    ]
  },
];

/**
 * Fetches models from the API and transforms them into ModelOutput format
 * @param url - API endpoint URL
 * @param api_key - API authentication key
 * @returns Promise<ModelOutput[]> - Array of processed model data
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  // console.log("fetchModels", url, api_key, type)
  try {
    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/**
 * Main handler function for the API endpoint
 * @param req - Request object containing options
 * @returns Promise<string> - JSON string of model data
 */
export default async function main(req: Request): Promise<string> {
  const options = await req.json();

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList({
    ...options,
    input_text: "refresh",
  });

  return JSON.stringify(models);
}
