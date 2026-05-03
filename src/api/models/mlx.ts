import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";

const MLX_BASE_URL = "http://127.0.0.1:54535/mlx_manage/model";

interface MlxModelEntry {
  size: string;
  downloadSize: string;
  context: number;
}

const AVAILABLE_MODELS: (MlxModelEntry & ListCache.ListItem)[] = [
  {
    title: "Gemma 4 E2B IT (4bit)",
    value: "mlx-community/gemma-4-e2b-it-4bit",
    description:
      "Google Gemma 4 dense 2B — MLX 4bit quantized, text + image + audio + thinking",
    size: "2B",
    downloadSize: "3.6 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
    audioEnable: true,
  },
  {
    title: "Qwen3.5-4B OptiQ (4bit)",
    value: "mlx-community/Qwen3.5-4B-OptiQ-4bit",
    description:
      "Qwen3.5-4B with OptiQ optimized quantization — compact, fast, strong reasoning for the size",
    size: "4B",
    downloadSize: "3.0 GB",
    context: 128000,
    toolUse: false,
  },
  {
    title: "Gemma 4 E2B IT (8bit)",
    value: "mlx-community/gemma-4-e2b-it-8bit",
    description:
      "Google Gemma 4 dense 2B — MLX 8bit quantized, text + image + audio + thinking",
    size: "2B",
    downloadSize: "5.9 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
    audioEnable: true,
  },
  {
    title: "Gemma 4 E4B IT (4bit)",
    value: "mlx-community/gemma-4-e4b-it-4bit",
    description:
      "Google Gemma 4 dense 4B — MLX 4bit quantized, text + image + audio + thinking",
    size: "4B",
    downloadSize: "5.2 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
    audioEnable: true,
  },
  {
    title: "Gemma 4 E4B IT (8bit)",
    value: "mlx-community/gemma-4-e4b-it-8bit",
    description:
      "Google Gemma 4 dense 4B — MLX 8bit quantized, text + image + audio + thinking",
    size: "4B",
    downloadSize: "9.0 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
    audioEnable: true,
  },
  {
    title: "Qwen3.5-9B (4bit)",
    value: "mlx-community/Qwen3.5-9B-MLX-4bit",
    description:
      "Qwen3.5-9B MLX 4bit — strong reasoning and instruction-following, optimized for Apple Silicon",
    size: "9B",
    downloadSize: "6.0 GB",
    context: 128000,
    toolUse: false,
  },
  {
    title: "Gemma 4 26B-A4B IT (4bit)",
    value: "mlx-community/gemma-4-26b-a4b-it-4bit",
    description:
      "Google Gemma 4 sparse MoE — MLX 4bit quantized, 26B params with about 4B active per token",
    size: "26B",
    downloadSize: "15.6 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
  },
  {
    title: "Gemma 4 26B-A4B IT (8bit)",
    value: "mlx-community/gemma-4-26b-a4b-it-8bit",
    description:
      "Google Gemma 4 sparse MoE — MLX 8bit quantized, 26B params with about 4B active per token",
    size: "26B",
    downloadSize: "28.0 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
  },
  {
    title: "Gemma 4 31B IT (4bit)",
    value: "mlx-community/gemma-4-31b-it-4bit",
    description:
      "Google Gemma 4 dense 31B — MLX 4bit quantized, text + image + thinking",
    size: "31B",
    downloadSize: "18.4 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
  },
  {
    title: "Gemma 4 31B IT (8bit)",
    value: "mlx-community/gemma-4-31b-it-8bit",
    description:
      "Google Gemma 4 dense 31B — MLX 8bit quantized, text + image + thinking",
    size: "31B",
    downloadSize: "33.8 GB",
    context: 128000,
    toolUse: false,
    visionEnable: true,
  },
  {
    title: "Qwen3.5-27B Claude-4.6-Opus Distilled (4bit)",
    value: "mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit",
    description:
      "Qwen3.5-27B distilled from Claude 4.6 Opus — strong reasoning and instruction-following, 4bit quantized for Apple Silicon",
    size: "27B",
    downloadSize: "15.2 GB",
    context: 128000,
    toolUse: false,
  },
  {
    title: "Qwen3.6-27B (4bit)",
    value: "mlx-community/Qwen3.6-27B-4bit",
    description:
      "Qwen3.6-27B sensitivity-aware mixed-precision quantization (avg 4.5 bpw) — same size, higher quality",
    size: "4B",
    downloadSize: "16.1 GB",
    context: 128000,
    toolUse: false,
  },
  {
    title: "Mistral 7B Instruct v0.3 (4bit)",
    value: "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
    description: "Mistral AI — efficient chat and instruction-following",
    size: "7B",
    downloadSize: "4.1 GB",
    context: 32768,
    toolUse: false,
  },
];

async function fetchModels(
  _options: RequestOptions,
): Promise<Preference.MLXModel[]> {
  const statuses = new Map<string, Preference.MLXModel["status"]>();
  await Promise.all(
    AVAILABLE_MODELS.map(async (m) => {
      try {
        const resp = await fetch(`${MLX_BASE_URL}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: m.value, category: "llm" }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            status?: Preference.MLXModel["status"];
          };
          if (data.status) statuses.set(m.value, data.status);
        }
      } catch {
        // host or python not yet up — leave default
      }
    }),
  );

  return AVAILABLE_MODELS.map((m) => ({
    type: "mlx_model",
    title: `${m.title} · ${m.size}`,
    value: m.value,
    description: m.description,
    status: statuses.get(m.value) ?? "not_downloaded",
    providerName: "mlx",
    context: m.context,
    toolUse: false,
    systemMessageEnable: true,
    download_size: m.downloadSize,
  }));
}

interface ModelsParams {
  /** Force refresh the cached model list @default false */
  forceRefresh?: boolean;
  /** Fuzzy search query to filter models by title */
  query?: string;
}

/**
 * List MLX-LM models served by the local mlx_manage extension.
 * @param {Request} request - Request object, body is {@link ModelsParams}
 */
export default async function main(request: Request) {
  const params = (await request.json().catch(() => ({}))) as ModelsParams;
  const cache = new ListCache(fetchModels);
  const models = await cache.getList({
    ...params,
    forceRefresh: true,
  } as unknown as RequestOptions);

  if (params.query) {
    const results = fuzzysort.go(params.query, models, {
      keys: ["title", "value"],
      threshold: -1000,
    });
    return Response.json(results.map((r) => r.obj));
  }

  return Response.json(models);
}
