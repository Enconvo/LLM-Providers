import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

/** Raw model entry from litellm's model_prices_and_context_window.json */
export interface LiteLLMModelEntry {
  litellm_provider?: string;
  mode?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
  max_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  output_cost_per_reasoning_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_tool_choice?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_system_messages?: boolean;
  supports_response_schema?: boolean;
  supports_audio_input?: boolean;
  supports_audio_output?: boolean;
  supports_video_input?: boolean;
  supports_pdf_input?: boolean;
  supports_reasoning?: boolean;
  supports_prompt_caching?: boolean;
  supports_web_search?: boolean;
  supports_computer_use?: boolean;
  supports_image_input?: boolean;
  supports_native_streaming?: boolean;
  supports_native_structured_output?: boolean;
  source?: string;
  deprecation_date?: string;
  supported_modalities?: string[];
  supported_output_modalities?: string[];
  rpm?: number;
  tpm?: number;
  tool_use_system_prompt_tokens?: number;
  output_vector_size?: number;
  [key: string]: unknown;
}

/** Normalized model info returned by the registry */
export interface ModelInfo {
  /** Model ID (e.g., "gpt-4o", "claude-3-5-sonnet-20241022") */
  id: string;
  /** Provider name (e.g., "openai", "anthropic", "google") */
  provider: string;
  /** Model mode (e.g., "chat", "embedding", "image_generation") */
  mode: string;
  /** Max input context window in tokens */
  maxInputTokens: number;
  /** Max output tokens */
  maxOutputTokens: number;
  /** Input cost per 1M tokens (USD) */
  inputPricePerMillion: number;
  /** Output cost per 1M tokens (USD) */
  outputPricePerMillion: number;
  /** Whether the model supports image/vision input */
  supportsVision: boolean;
  /** Whether the model supports function/tool calling */
  supportsToolUse: boolean;
  /** Whether the model supports system messages */
  supportsSystemMessages: boolean;
  /** Whether the model supports audio input */
  supportsAudioInput: boolean;
  /** Whether the model supports audio output */
  supportsAudioOutput: boolean;
  /** Whether the model supports video input */
  supportsVideoInput: boolean;
  /** Whether the model supports PDF input */
  supportsPdfInput: boolean;
  /** Whether the model supports reasoning/thinking */
  supportsReasoning: boolean;
  /** Whether the model supports prompt caching */
  supportsPromptCaching: boolean;
  /** Whether the model supports web search */
  supportsWebSearch: boolean;
  /** Whether the model supports structured output / JSON schema */
  supportsStructuredOutput: boolean;
  /** Whether the model supports streaming */
  supportsStreaming: boolean;
  /** Deprecation date if the model is deprecated */
  deprecationDate?: string;
  /** Raw entry from litellm for advanced use */
  raw: LiteLLMModelEntry;
}

export interface ModelFilter {
  provider?: string;
  mode?: string;
  supportsVision?: boolean;
  supportsToolUse?: boolean;
  supportsSystemMessages?: boolean;
  supportsReasoning?: boolean;
  supportsAudioInput?: boolean;
  supportsVideoInput?: boolean;
  supportsWebSearch?: boolean;
  supportsStructuredOutput?: boolean;
  minContextTokens?: number;
  maxInputPricePerMillion?: number;
}

// ============================================================================
// Cache config
// ============================================================================

const DATA_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const CACHE_DIR = path.join(os.homedir(), ".cache", "enconvo", "llm-registry");
const CACHE_FILE = path.join(CACHE_DIR, "model_prices_and_context_window.json");
const META_FILE = path.join(CACHE_DIR, "meta.json");

/** How long before we consider the cache stale and trigger a background refresh (ms) */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

/** How long before the cache is considered expired and we must fetch before serving (ms) */
const EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// Internal state
// ============================================================================

interface CacheMeta {
  etag?: string;
  lastModified?: string;
  fetchedAt: number;
  sha256?: string;
}

let _models: Map<string, ModelInfo> | null = null;
let _refreshPromise: Promise<void> | null = null;

// ============================================================================
// Cache I/O
// ============================================================================

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readMeta(): CacheMeta | null {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    }
  } catch {
    // corrupt meta, ignore
  }
  return null;
}

function writeMeta(meta: CacheMeta): void {
  ensureCacheDir();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), "utf-8");
}

function readCachedData(): Record<string, LiteLLMModelEntry> | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    }
  } catch {
    // corrupt cache, ignore
  }
  return null;
}

function writeCachedData(data: Record<string, LiteLLMModelEntry>): void {
  ensureCacheDir();
  const json = JSON.stringify(data);
  const sha256 = crypto.createHash("sha256").update(json).digest("hex");
  fs.writeFileSync(CACHE_FILE, json, "utf-8");
  return void sha256; // returned via meta
}

// ============================================================================
// Network fetch with conditional requests
// ============================================================================

async function fetchFromGitHub(
  meta: CacheMeta | null,
): Promise<{ data: Record<string, LiteLLMModelEntry>; meta: CacheMeta } | null> {
  const headers: Record<string, string> = {};
  if (meta?.etag) {
    headers["If-None-Match"] = meta.etag;
  }
  if (meta?.lastModified) {
    headers["If-Modified-Since"] = meta.lastModified;
  }

  try {
    const resp = await axios.get(DATA_URL, {
      headers,
      timeout: 30_000,
      validateStatus: (s) => s === 200 || s === 304,
    });

    if (resp.status === 304) {
      // Not modified - update fetchedAt only
      return null;
    }

    const data = resp.data as Record<string, LiteLLMModelEntry>;
    const json = JSON.stringify(data);
    const sha256 = crypto.createHash("sha256").update(json).digest("hex");

    return {
      data,
      meta: {
        etag: resp.headers["etag"] ?? undefined,
        lastModified: resp.headers["last-modified"] ?? undefined,
        fetchedAt: Date.now(),
        sha256,
      },
    };
  } catch (err) {
    console.warn("[ModelRegistry] Failed to fetch from GitHub:", (err as Error).message);
    return null;
  }
}

// ============================================================================
// Data normalization
// ============================================================================

function normalizeEntry(id: string, entry: LiteLLMModelEntry): ModelInfo {
  const inputCostPerToken = entry.input_cost_per_token ?? 0;
  const outputCostPerToken = entry.output_cost_per_token ?? 0;

  return {
    id,
    provider: entry.litellm_provider ?? "unknown",
    mode: entry.mode ?? "chat",
    maxInputTokens: entry.max_input_tokens ?? entry.max_tokens ?? 0,
    maxOutputTokens: entry.max_output_tokens ?? entry.max_tokens ?? 0,
    inputPricePerMillion: inputCostPerToken * 1_000_000,
    outputPricePerMillion: outputCostPerToken * 1_000_000,
    supportsVision: entry.supports_vision ?? entry.supports_image_input ?? false,
    supportsToolUse: entry.supports_function_calling ?? false,
    supportsSystemMessages: entry.supports_system_messages ?? true,
    supportsAudioInput: entry.supports_audio_input ?? false,
    supportsAudioOutput: entry.supports_audio_output ?? false,
    supportsVideoInput: entry.supports_video_input ?? false,
    supportsPdfInput: entry.supports_pdf_input ?? false,
    supportsReasoning: entry.supports_reasoning ?? false,
    supportsPromptCaching: entry.supports_prompt_caching ?? false,
    supportsWebSearch: entry.supports_web_search ?? false,
    supportsStructuredOutput: entry.supports_response_schema ?? entry.supports_native_structured_output ?? false,
    supportsStreaming: entry.supports_native_streaming ?? true,
    deprecationDate: entry.deprecation_date,
    raw: entry,
  };
}

function buildIndex(raw: Record<string, LiteLLMModelEntry>): Map<string, ModelInfo> {
  const map = new Map<string, ModelInfo>();
  for (const [id, entry] of Object.entries(raw)) {
    if (id === "sample_spec") continue;
    map.set(id, normalizeEntry(id, entry));
  }
  return map;
}

// ============================================================================
// Core loading logic (stale-while-revalidate)
// ============================================================================

function loadFromCache(): boolean {
  const data = readCachedData();
  if (data) {
    _models = buildIndex(data);
    return true;
  }
  return false;
}

async function refreshInBackground(): Promise<void> {
  if (_refreshPromise) return; // already refreshing

  _refreshPromise = (async () => {
    try {
      const meta = readMeta();
      const result = await fetchFromGitHub(meta);

      if (result) {
        // New data
        writeCachedData(result.data);
        writeMeta(result.meta);
        _models = buildIndex(result.data);
      } else if (meta) {
        // 304 Not Modified - just bump fetchedAt
        writeMeta({ ...meta, fetchedAt: Date.now() });
      }
    } finally {
      _refreshPromise = null;
    }
  })();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the model registry.
 * Loads from local cache first, then refreshes from GitHub if stale.
 * Call this once at startup or let it auto-init on first query.
 */
export async function init(): Promise<void> {
  const meta = readMeta();
  const now = Date.now();
  const hasCacheOnDisk = loadFromCache();

  if (!hasCacheOnDisk) {
    // No cache at all - must fetch synchronously
    const result = await fetchFromGitHub(null);
    if (result) {
      writeCachedData(result.data);
      writeMeta(result.meta);
      _models = buildIndex(result.data);
    } else {
      // Network failed, no cache - empty registry
      _models = new Map();
    }
    return;
  }

  if (meta) {
    const age = now - meta.fetchedAt;

    if (age > EXPIRE_AFTER_MS) {
      // Expired - block until refreshed
      await refreshInBackground();
    } else if (age > STALE_AFTER_MS) {
      // Stale - serve cache, refresh in background
      void refreshInBackground();
    }
    // Fresh - use cache as-is
  } else {
    // Have cache but no meta - trigger background refresh
    void refreshInBackground();
  }
}

/** Ensure models are loaded, auto-init if needed */
async function ensureLoaded(): Promise<Map<string, ModelInfo>> {
  if (!_models) {
    await init();
  }
  return _models!;
}

/**
 * Get a single model by ID.
 * Supports exact match and fallback with provider prefix stripping.
 *
 * @example
 * ```ts
 * const model = await getModel("gpt-4o");
 * const model = await getModel("openai/gpt-4o");
 * ```
 */
export async function getModel(modelId: string): Promise<ModelInfo | undefined> {
  const models = await ensureLoaded();

  // Exact match first
  let model = models.get(modelId);
  if (model) return model;

  // Try with common provider prefixes
  // litellm uses "provider/model" format for some entries
  const entries = Array.from(models.entries());
  for (const [key, value] of entries) {
    if (key.endsWith(`/${modelId}`)) return value;
    // Also try if the user passed "provider/model" but the key is just "model"
    if (modelId.endsWith(`/${key}`)) return value;
  }

  return undefined;
}

/**
 * Get all models, optionally filtered.
 *
 * @example
 * ```ts
 * // All chat models with vision
 * const models = await getModels({ mode: "chat", supportsVision: true });
 *
 * // All Anthropic models
 * const models = await getModels({ provider: "anthropic" });
 *
 * // Models with 100k+ context under $5/1M input tokens
 * const models = await getModels({ minContextTokens: 100000, maxInputPricePerMillion: 5 });
 * ```
 */
export async function getModels(filter?: ModelFilter): Promise<ModelInfo[]> {
  const models = await ensureLoaded();
  let results = Array.from(models.values());

  if (!filter) return results;

  if (filter.provider) {
    const p = filter.provider.toLowerCase();
    results = results.filter((m) => m.provider.toLowerCase() === p);
  }
  if (filter.mode) {
    results = results.filter((m) => m.mode === filter.mode);
  }
  if (filter.supportsVision !== undefined) {
    results = results.filter((m) => m.supportsVision === filter.supportsVision);
  }
  if (filter.supportsToolUse !== undefined) {
    results = results.filter((m) => m.supportsToolUse === filter.supportsToolUse);
  }
  if (filter.supportsSystemMessages !== undefined) {
    results = results.filter((m) => m.supportsSystemMessages === filter.supportsSystemMessages);
  }
  if (filter.supportsReasoning !== undefined) {
    results = results.filter((m) => m.supportsReasoning === filter.supportsReasoning);
  }
  if (filter.supportsAudioInput !== undefined) {
    results = results.filter((m) => m.supportsAudioInput === filter.supportsAudioInput);
  }
  if (filter.supportsVideoInput !== undefined) {
    results = results.filter((m) => m.supportsVideoInput === filter.supportsVideoInput);
  }
  if (filter.supportsWebSearch !== undefined) {
    results = results.filter((m) => m.supportsWebSearch === filter.supportsWebSearch);
  }
  if (filter.supportsStructuredOutput !== undefined) {
    results = results.filter((m) => m.supportsStructuredOutput === filter.supportsStructuredOutput);
  }
  if (filter.minContextTokens !== undefined) {
    results = results.filter((m) => m.maxInputTokens >= filter.minContextTokens!);
  }
  if (filter.maxInputPricePerMillion !== undefined) {
    results = results.filter((m) => m.inputPricePerMillion <= filter.maxInputPricePerMillion!);
  }

  return results;
}

/**
 * Get all unique provider names in the registry.
 */
export async function getProviders(): Promise<string[]> {
  const models = await ensureLoaded();
  const providers = new Set<string>();
  const values = Array.from(models.values());
  for (const m of values) {
    providers.add(m.provider);
  }
  return Array.from(providers).sort();
}

/**
 * Get model info and map it to the Enconvo LLMModel-compatible shape.
 * Useful for enriching provider-fetched models with litellm data.
 *
 * @returns Partial fields that can be spread into a Preference.LLMModel object,
 *          or undefined if the model is not found.
 *
 * @example
 * ```ts
 * const info = await getModelForEnconvo("claude-3-5-sonnet-20241022");
 * // { context: 200000, maxTokens: 8192, inputPrice: 3, outputPrice: 15, toolUse: true, visionEnable: true, ... }
 * ```
 */
export async function getModelForEnconvo(
  modelId: string,
): Promise<
  | {
    context: number;
    maxTokens: number;
    inputPrice: number;
    outputPrice: number;
    toolUse: boolean;
    visionEnable: boolean;
    audioEnable: boolean;
    videoEnable: boolean;
    systemMessageEnable: boolean;
  }
  | undefined
> {
  const model = await getModel(modelId);
  if (!model) return undefined;

  return {
    context: model.maxInputTokens,
    maxTokens: model.maxOutputTokens,
    inputPrice: model.inputPricePerMillion,
    outputPrice: model.outputPricePerMillion,
    toolUse: model.supportsToolUse,
    visionEnable: model.supportsVision,
    audioEnable: model.supportsAudioInput,
    videoEnable: model.supportsVideoInput,
    systemMessageEnable: model.supportsSystemMessages,
  };
}

/**
 * Force an immediate refresh from GitHub (ignoring cache age).
 */
export async function forceRefresh(): Promise<void> {
  const result = await fetchFromGitHub(null);
  if (result) {
    writeCachedData(result.data);
    writeMeta(result.meta);
    _models = buildIndex(result.data);
  }
}

/**
 * Get cache status information.
 */
export function getCacheStatus(): {
  hasCachedData: boolean;
  fetchedAt: number | null;
  ageMs: number | null;
  isStale: boolean;
  isExpired: boolean;
  modelCount: number;
} {
  const meta = readMeta();
  const now = Date.now();
  const age = meta ? now - meta.fetchedAt : null;

  return {
    hasCachedData: fs.existsSync(CACHE_FILE),
    fetchedAt: meta?.fetchedAt ?? null,
    ageMs: age,
    isStale: age !== null ? age > STALE_AFTER_MS : true,
    isExpired: age !== null ? age > EXPIRE_AFTER_MS : true,
    modelCount: _models?.size ?? 0,
  };
}

/**
 * Clear in-memory cache. Next query will reload from disk/network.
 */
export function clearMemoryCache(): void {
  _models = null;
}

/**
 * Clear all cached data (disk + memory). Next query will fetch from GitHub.
 */
export function clearAllCache(): void {
  clearMemoryCache();
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    if (fs.existsSync(META_FILE)) fs.unlinkSync(META_FILE);
  } catch {
    // ignore
  }
}
