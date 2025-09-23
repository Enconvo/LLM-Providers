import { ListCache, RequestOptions } from "@enconvo/api";
import { Ollama } from "ollama";

const embeddingModels = [
  {
    title: "nomic-embed-text",
    value: "nomic-embed-text",
    context: 8192,
    dimension: 768,
  },
  {
    title: "mxbai-embed-large",
    value: "mxbai-embed-large",
    context: 512,
    dimension: 1024,
  },
  {
    title: "snowflake-arctic-embed", // Default 335M parameter model
    value: "snowflake-arctic-embed",
    context: 512,
    dimension: 1024,
  },
  {
    title: "snowflake-arctic-embed:335m", // Default 335M parameter model
    value: "snowflake-arctic-embed:335m",
    context: 512,
    dimension: 1024,
  },
  {
    title: "snowflake-arctic-embed:137m", // 137M parameter model
    value: "snowflake-arctic-embed:137m",
    context: 8192,
    dimension: 768,
  },
  {
    title: "snowflake-arctic-embed:110m", // 110M parameter model
    value: "snowflake-arctic-embed:110m",
    context: 512,
    dimension: 768,
  },
  {
    title: "snowflake-arctic-embed:33m", // 33M parameter model
    value: "snowflake-arctic-embed:33m",
    context: 512,
    dimension: 384,
  },
  {
    title: "snowflake-arctic-embed:22m", // 22M parameter model
    value: "snowflake-arctic-embed:22m",
    context: 512,
    dimension: 384,
  },
  {
    title: "all-minilm", // Embedding model trained on large sentence datasets
    value: "all-minilm",
    context: 256,
    dimension: 384,
  },
  {
    title: "embedding:22m", // 22M parameter embedding model
    value: "embedding:22m",
    context: 256,
    dimension: 384,
  },
  {
    title: "embedding:33m", // 33M parameter embedding model
    value: "embedding:33m",
    context: 256,
    dimension: 384,
  },
  {
    title: "bge-m3", // 33M parameter embedding model
    value: "bge-m3",
    context: 8192,
    dimension: 1024,
  },
  {
    title: "bge-large", // 33M parameter embedding model
    value: "bge-large",
    context: 512,
    dimension: 1024,
  },
  {
    title: "paraphrase-multilingual", // 33M parameter embedding model
    value: "paraphrase-multilingual",
    context: 128,
    dimension: 768,
  },
];

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
    // console.log("ollama list", JSON.stringify(list, null, 2));
    models = list.models
      .filter(
        (item) => !embeddingModels.some((em) => item.name.includes(em.value)),
      )
      .map((item) => {
        return {
          title: item.name,
          value: item.name,
          providerName: item.details.family,
          context: 8000,
          maxTokens: 1024,
          // Add vision flag for vision-capable models
          visionEnable:
            item.name.includes("llava") || item.name.includes("vision"),
        };
      });
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
