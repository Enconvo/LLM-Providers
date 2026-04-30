import { ListCache, Preference, RequestOptions } from "@enconvo/api";
import fuzzysort from "fuzzysort";

const MLX_BASE_URL = "http://127.0.0.1:54535/mlx_manage/model";

interface MlxModelEntry {
  title: string;
  value: string;
  description: string;
  size: string;
  downloadSize: string;
  context: number;
  toolUse?: boolean;
}

const AVAILABLE_MODELS: MlxModelEntry[] = [
  {
    title: "Qwen3.5-9B (4bit)",
    value: "mlx-community/Qwen3.5-9B-MLX-4bit",
    description:
      "Qwen3.5-9B MLX 4bit — strong reasoning and instruction-following, optimized for Apple Silicon",
    size: "9B",
    downloadSize: "5.0 GB",
    context: 128000,
    toolUse: true,
  },
  {
    title: "Qwen3.5-27B Claude-4.6-Opus Distilled (4bit)",
    value: "mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit",
    description:
      "Qwen3.5-27B distilled from Claude 4.6 Opus — strong reasoning and instruction-following, 4bit quantized for Apple Silicon",
    size: "27B",
    downloadSize: "15.2 GB",
    context: 128000,
    toolUse: true,
  },
  {
    title: "Qwen3.6-27B (4bit)",
    value: "mlx-community/Qwen3.6-27B-4bit",
    description:
      "Qwen3.6-27B sensitivity-aware mixed-precision quantization (avg 4.5 bpw) — same size, higher quality",
    size: "4B",
    downloadSize: "2.8 GB",
    context: 128000,
    toolUse: false,
  },
  {
    title: "Qwen3 8B (4bit)",
    value: "mlx-community/Qwen3-8B-4bit",
    description: "Latest Qwen3 — hybrid thinking mode, 100+ languages",
    size: "8B",
    downloadSize: "4.3 GB",
    context: 32768,
    toolUse: true,
  },
  {
    title: "Qwen2.5 7B Instruct (4bit)",
    value: "mlx-community/Qwen2.5-7B-Instruct-4bit",
    description: "Alibaba Qwen2.5 — high-quality multilingual chat, coding, math",
    size: "7B",
    downloadSize: "4.0 GB",
    context: 32768,
    toolUse: true,
  },
  {
    title: "Llama 3.3 70B Instruct (4bit)",
    value: "mlx-community/Llama-3.3-70B-Instruct-4bit",
    description: "Meta Llama 3.3 — powerful multilingual instruction-following",
    size: "70B",
    downloadSize: "37.0 GB",
    context: 128000,
    toolUse: true,
  },
  {
    title: "Llama 4 Scout 17B (4bit)",
    value: "mlx-community/Llama-4-Scout-17B-16E-Instruct-4bit",
    description: "Meta Llama 4 Scout — mixture of experts",
    size: "17B",
    downloadSize: "56.9 GB",
    context: 128000,
    toolUse: true,
  },
  {
    title: "Mistral 7B Instruct v0.3 (4bit)",
    value: "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
    description: "Mistral AI — efficient chat and instruction-following",
    size: "7B",
    downloadSize: "3.8 GB",
    context: 32768,
    toolUse: true,
  },
  {
    title: "Gemma 2 9B IT (4bit)",
    value: "mlx-community/gemma-2-9b-it-4bit",
    description: "Google Gemma 2 — compact yet capable, multilingual",
    size: "9B",
    downloadSize: "4.9 GB",
    context: 8192,
  },
  {
    title: "Phi-4 Mini Instruct (4bit)",
    value: "mlx-community/phi-4-mini-instruct-4bit",
    description: "Microsoft Phi-4 Mini — small and fast, strong reasoning",
    size: "3.8B",
    downloadSize: "2.0 GB",
    context: 128000,
  },
  {
    title: "DeepSeek R1 Distill Qwen 7B (4bit)",
    value: "mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit",
    description: "DeepSeek R1 distilled — chain-of-thought reasoning",
    size: "7B",
    downloadSize: "4.0 GB",
    context: 32768,
  },
  {
    title: "DeepSeek R1 Distill Llama 8B (4bit)",
    value: "mlx-community/DeepSeek-R1-Distill-Llama-8B-4bit",
    description: "DeepSeek R1 distilled on Llama — strong reasoning",
    size: "8B",
    downloadSize: "4.2 GB",
    context: 32768,
  },
  {
    title: "SmolLM2 1.7B Instruct",
    value: "mlx-community/SmolLM2-1.7B-Instruct-bf16",
    description: "HuggingFace SmolLM2 — ultra lightweight, fast responses",
    size: "1.7B",
    downloadSize: "3.4 GB",
    context: 8192,
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
          body: JSON.stringify({ model_id: m.value }),
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
    toolUse: m.toolUse,
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
  const models = await cache.getList({ ...params, forceRefresh: true });

  if (params.query) {
    const results = fuzzysort.go(params.query, models, {
      keys: ["title", "value"],
      threshold: -1000,
    });
    return Response.json(results.map((r) => r.obj));
  }

  return Response.json(models);
}
