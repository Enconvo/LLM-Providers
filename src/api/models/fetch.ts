import { ListCache, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";

/**
 * Fetches models from a generic OpenAI-compatible API endpoint
 */
async function fetchModels(
  options: RequestOptions,
): Promise<ListCache.ListItem[]> {
  let { url, api_key, type } = options;
  try {
    if (type) {
      url = `${url}?type=${type}`;
    }
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${api_key}`,
      },
    });

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

/** Generic model fetch request params */
interface FetchModelsParams {
  /** API endpoint URL @required */
  url: string;
  /** API authentication key @required */
  api_key: string;
  /** Model type filter */
  type?: string;
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search model list from a generic OpenAI-compatible endpoint
 * @param {Request} request - Request object, body is {@link FetchModelsParams}
 * @returns List of available models, optionally filtered by fuzzy search query
 */
export default async function main(request: Request) {
  const params = await request.json() as FetchModelsParams;

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(params);

  if (params.query) {
    const results = fuzzysort.go(params.query, models, {
      keys: ["title", "value"],
      threshold: -1000,
    });
    return Response.json(results.map((r) => r.obj));
  }

  return Response.json(models);
}
