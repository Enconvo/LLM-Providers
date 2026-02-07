import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import { Ollama } from "ollama";

async function fetchModels(options: RequestOptions) {
  const credentials = options.credentials;

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
        };

        if (model.thinking) {
          model.preferences = [
            {
              name: "reasoning_effort",
              description: "Applicable to reasoning models only, this option controls the reasoning token length.",
              type: "dropdown",
              required: false,
              title: "Reasoning Effort",
              "default": "disabled",
              "data": [
                {
                  "title": "None",
                  "value": "disabled",
                  "description": "Disabled"
                },
                {
                  "title": "Thinking",
                  "value": "enabled",
                  "description": "Enabled"
                }
              ]
            }
          ]
        }
        return model;
      }))).filter((item) => item !== null);
  } catch (err) {
    console.log(err);
  }

  return models;
}

export default async function main(req: Request) {
  const options = await req.json();

  const modelCache = new ListCache(fetchModels);

  const models = await modelCache.getList(options);
  return JSON.stringify(models);
}
