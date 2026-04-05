import { CommandManageUtils, ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";
import { Ollama } from "ollama";
import { getReasoningEffortPreference } from "../../utils/reasoning_effort_data.ts";

async function fetchModels(_options: RequestOptions) {
  const config = await CommandManageUtils.loadCommandConfig({
    commandKey: "llm|ollama",
    includes: ['credentials'],
    useAsRunParams: true
  });
  const credentials = config.credentials;

  const customHeaders: Record<string, string> = {};
  if (credentials?.customHeaders) {
    const headerString = credentials.customHeaders as string;
    const headerPairs = headerString
      .split("\n")
      .filter((line) => line.trim() && line.trim().includes("="));
    for (const pair of headerPairs) {
      const [key, value] = pair.split("=");
      if (key && value) {
        customHeaders[key.trim()] = value.trim();
      }
    }
  }

  const ollama = new Ollama({
    host: credentials?.baseUrl,
    headers: {
      ...customHeaders,
      Authorization: `Bearer ${credentials?.apiKey || ""}`,
      "User-Agent": "Enconvo/1.0",
    },
  });

  let models: ListCache.ListItem[] = [];
  try {
    const list = await ollama.list();
    models = (await Promise.all(list.models
      .map(async (item) => {
        const modelInfo = await ollama.show({ model: item.name });
        console.log("ollama modelInfo", JSON.stringify(modelInfo.capabilities, null, 2));
        if (!modelInfo.capabilities.includes("completion")) {
          return null;
        }

        const model: Preference.LLMModel = {
          title: item.name,
          value: item.name,
          type: "llm_model",
          providerName: item.details.family,
          toolUse: modelInfo.capabilities.includes("tools"),
          thinking: modelInfo.capabilities.includes("thinking"),
          context: 8000,
          maxTokens: 1024,
          visionEnable: modelInfo.capabilities.includes("vision"),
          systemMessageEnable: true,
        };

        if (model.thinking) {
          const reasoningPref = getReasoningEffortPreference(item.name, "ollama");
          if (reasoningPref) {
            model.preferences = [reasoningPref];
          }
        }
        return model;
      }))).filter((item) => item !== null);
  } catch (err) {
    console.log(err);
  }

  return models;
}

/** Ollama models list request params */
interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by name */
  query?: string;
}

/**
 * Fetch and search Ollama model list
 * @param {Request} request - Request object, body is {@link ModelsParams}
 * @returns List of available models, optionally filtered by fuzzy search query
 */
export default async function main(request: Request) {
  const params = await request.json() as ModelsParams;
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
