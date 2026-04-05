import { ListCache, RequestOptions } from "@enconvo/api";

/**
 * Fetches models from the Enconvo AI remote JSON endpoint
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  let { url } = options;
  try {
    const resp = await fetch(url, {});

    if (!resp.ok) {
      throw new Error(`API request failed with status ${resp.status}`);
    }

    const data = await resp.json();
    return data;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/** Enconvo AI models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Enconvo AI model list
 * @param {Request} request - Request object, body is {@link ModelsParams}
 * @returns List of available models
 */
export default async function main(request: Request) {
  const options = await request.json() as ModelsParams;

  // console.log('options', req.url, options)

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList({ ...options, url: 'https://file.enconvo.com/modles/enconvo.json' });
  // console.log("enconvo models", models)

  return Response.json(models)
}
