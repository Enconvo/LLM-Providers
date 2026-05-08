export interface ProviderTokenBucket {
  total: number;
  uncached?: number;
  text?: number;
  image?: number;
  audio?: number;
  video?: number;
  file?: number;
  cached?: number;
  cacheCreation?: number;
  cacheCreationEphemeral1h?: number;
  cacheCreationEphemeral5m?: number;
  reasoning?: number;
  acceptedPrediction?: number;
  rejectedPrediction?: number;
  [key: string]: number | undefined;
}

export interface ProviderUsage {
  inputTokens: ProviderTokenBucket;
  outputTokens: ProviderTokenBucket;
  total: number;
  serviceTier?: string;
  rawUsage?: Record<string, unknown>;
}

const STANDARD_USAGE_KEYS = new Set([
  "inputTokens",
  "outputTokens",
  "total",
  "serviceTier",
  "rawUsage",
]);

export function normalizeProviderUsage(
  rawUsage: unknown,
): ProviderUsage | undefined {
  const raw = unwrapUsage(rawUsage);
  if (!raw) return undefined;

  const inputTokens = normalizeBucket(
    raw.inputTokens,
    firstNumber(
      raw.input_tokens,
      raw.uncached_input_tokens,
      raw.prompt_tokens,
      raw.promptTokenCount,
      raw.inputTokenCount,
      typeof raw.inputTokens === "number" ? raw.inputTokens : undefined,
    ),
  );
  const outputTokens = normalizeBucket(
    raw.outputTokens,
    firstNumber(
      raw.output_tokens,
      raw.completion_tokens,
      raw.candidatesTokenCount,
      raw.outputTokenCount,
      typeof raw.outputTokens === "number" ? raw.outputTokens : undefined,
    ),
  );

  applyModalityDetails(
    inputTokens,
    raw.promptTokensDetails ??
      raw.prompt_tokens_details ??
      raw.input_tokens_details,
    "input",
  );
  applyModalityDetails(
    outputTokens,
    raw.candidatesTokensDetails ??
      raw.completion_tokens_details ??
      raw.output_tokens_details,
    "output",
  );

  const baseInputTotal = inputTokens.total;
  const cached = firstNumber(
    raw.cache_read_input_tokens,
    raw.cached_input_tokens,
    raw.cachedInputTokens,
    raw.input_cached_tokens,
    raw.cachedContentTokenCount,
    raw.prompt_tokens_details?.cached_tokens,
    raw.input_tokens_details?.cached_tokens,
    raw.input_tokens_details?.cache_read_tokens,
    raw.inputTokenDetails?.cachedTokens,
    raw.inputTokenDetails?.cacheReadTokens,
  );
  if (cached !== undefined && inputTokens.cached === undefined) {
    inputTokens.cached = cached;
  }

  const cacheCreation = firstNumber(
    raw.cache_creation_input_tokens,
    raw.prompt_tokens_details?.cache_write_tokens,
    raw.input_tokens_details?.cache_creation_tokens,
    raw.input_tokens_details?.cache_write_tokens,
    raw.inputTokenDetails?.cacheWriteTokens,
    cacheCreationTotal(raw.cache_creation),
  );
  if (cacheCreation !== undefined && inputTokens.cacheCreation === undefined) {
    inputTokens.cacheCreation = cacheCreation;
  }
  applyAnthropicCacheCreationDetails(inputTokens, raw.cache_creation);

  normalizeInputTokenTotals(inputTokens, raw, baseInputTotal);

  const inputAudio = firstNumber(
    raw.prompt_tokens_details?.audio_tokens,
    raw.input_tokens_details?.audio_tokens,
  );
  if (inputAudio !== undefined && inputTokens.audio === undefined) {
    inputTokens.audio = inputAudio;
  }

  const outputAudio = firstNumber(
    raw.completion_tokens_details?.audio_tokens,
    raw.output_tokens_details?.audio_tokens,
  );
  if (outputAudio !== undefined && outputTokens.audio === undefined) {
    outputTokens.audio = outputAudio;
  }

  const reasoning = firstNumber(
    raw.completion_tokens_details?.reasoning_tokens,
    raw.output_tokens_details?.reasoning_tokens,
    raw.outputTokenDetails?.reasoningTokens,
    raw.reasoning_tokens,
    raw.reasoningTokens,
    raw.thoughtsTokenCount,
  );
  if (reasoning !== undefined && outputTokens.reasoning === undefined) {
    outputTokens.reasoning = reasoning;
  }

  const acceptedPrediction = firstNumber(
    raw.completion_tokens_details?.accepted_prediction_tokens,
    raw.output_tokens_details?.accepted_prediction_tokens,
    raw.outputTokenDetails?.acceptedPredictionTokens,
  );
  if (
    acceptedPrediction !== undefined &&
    outputTokens.acceptedPrediction === undefined
  ) {
    outputTokens.acceptedPrediction = acceptedPrediction;
  }

  const rejectedPrediction = firstNumber(
    raw.completion_tokens_details?.rejected_prediction_tokens,
    raw.output_tokens_details?.rejected_prediction_tokens,
    raw.outputTokenDetails?.rejectedPredictionTokens,
  );
  if (
    rejectedPrediction !== undefined &&
    outputTokens.rejectedPrediction === undefined
  ) {
    outputTokens.rejectedPrediction = rejectedPrediction;
  }

  const geminiThoughts = firstNumber(raw.thoughtsTokenCount);
  if (geminiThoughts !== undefined) {
    const candidatesTotal = firstNumber(
      raw.candidatesTokenCount,
      raw.outputTokenCount,
      raw.output_tokens,
      raw.completion_tokens,
    ) ?? outputTokens.total;
    outputTokens.total = Math.max(outputTokens.total, candidatesTotal + geminiThoughts);
  }

  const computedTotal = inputTokens.total + outputTokens.total;
  const total =
    computedTotal ||
    firstNumber(raw.total, raw.total_tokens, raw.totalTokens, raw.totalTokenCount) ||
    0;

  if (!hasTokenData(inputTokens, outputTokens, total)) {
    return undefined;
  }

  const normalized: ProviderUsage = {
    inputTokens,
    outputTokens,
    total,
    serviceTier: stringValue(raw.service_tier ?? raw.serviceTier),
    rawUsage: cloneJsonSafe(raw),
  };

  return normalized;
}

export function usageFromOpenAIChatUsage(
  rawUsage: unknown,
): ProviderUsage | undefined {
  return normalizeProviderUsage(rawUsage);
}

export function usageFromOpenAIResponseUsage(
  rawUsage: unknown,
): ProviderUsage | undefined {
  return normalizeProviderUsage(rawUsage);
}

export function usageFromAnthropicUsage(
  rawUsage: unknown,
): ProviderUsage | undefined {
  return normalizeProviderUsage(rawUsage);
}

export function usageFromGoogleUsageMetadata(
  rawUsage: unknown,
): ProviderUsage | undefined {
  return normalizeProviderUsage(rawUsage);
}

export function usageFromVercelAIUsage(
  rawUsage: unknown,
): ProviderUsage | undefined {
  return normalizeProviderUsage(rawUsage);
}

export function additionalWithProviderUsage<
  T extends { metadata?: Record<string, unknown> },
>(additional: T | undefined, rawUsage: unknown): T | undefined {
  const providerUsage = normalizeProviderUsage(rawUsage);
  if (!providerUsage) return additional;

  return {
    ...(additional ?? ({} as T)),
    metadata: {
      ...(additional?.metadata ?? {}),
      providerUsage,
    },
  };
}

export function usageFromResponseEnvelope(
  response: unknown,
): ProviderUsage | undefined {
  const raw = asRecord(response);
  if (!raw) return undefined;

  return normalizeProviderUsage(
    raw.usage ??
      raw.token_usage ??
      raw.tokenUsage ??
      raw.usageMetadata ??
      asRecord(raw.data)?.usage ??
      asRecord(raw.data)?.token_usage ??
      asRecord(raw.data)?.tokenUsage ??
      asRecord(raw.aiRecord)?.usage ??
      asRecord(asRecord(raw.aiRecord)?.aiRecordDetail)?.usage,
  );
}

function unwrapUsage(rawUsage: unknown): Record<string, any> | undefined {
  const raw = asRecord(rawUsage);
  if (!raw) return undefined;

  return (asRecord(raw.usage) ??
    asRecord(raw.token_usage) ??
    asRecord(raw.tokenUsage) ??
    asRecord(raw.usageMetadata) ??
    raw) as Record<string, any>;
}

function normalizeBucket(
  bucket: unknown,
  fallbackTotal: number | undefined,
): ProviderTokenBucket {
  const normalized: ProviderTokenBucket = {
    total:
      typeof bucket === "number" ? Math.max(0, bucket) : (fallbackTotal ?? 0),
  };

  if (bucket && typeof bucket === "object") {
    for (const [key, value] of Object.entries(bucket)) {
      const amount = numeric(value);
      if (amount !== undefined || key === "total") {
        normalized[key] = amount ?? 0;
      }
    }
  }

  if (!normalized.total) {
    const { total: _total, ...parts } = normalized;
    normalized.total = Object.values(parts).reduce<number>(
      (sum, value) => sum + (numeric(value) ?? 0),
      0,
    );
  }

  return normalized;
}

function normalizeInputTokenTotals(
  inputTokens: ProviderTokenBucket,
  raw: Record<string, any>,
  baseInputTotal: number,
) {
  const cached = inputTokens.cached ?? 0;
  const cacheCreation = inputTokens.cacheCreation ?? 0;
  const hasStructuredInputBucket =
    raw.inputTokens &&
    typeof raw.inputTokens === "object" &&
    numeric(raw.inputTokens.total) !== undefined;

  const cacheParts = cached + cacheCreation;
  if (hasStructuredInputBucket) {
    if (cacheParts > 0 && baseInputTotal < cacheParts) {
      inputTokens.uncached = baseInputTotal;
      inputTokens.total = baseInputTotal + cacheParts;
      return;
    }
    if (cacheParts > 0 && inputTokens.uncached === undefined) {
      inputTokens.uncached = Math.max(0, inputTokens.total - cacheParts);
    }
    return;
  }

  const additiveCacheTokens =
    (firstNumber(
      raw.cache_read_input_tokens,
      raw.cached_input_tokens,
      raw.cachedInputTokens,
    ) ?? 0) +
    (firstNumber(
      raw.cache_creation_input_tokens,
      cacheCreationTotal(raw.cache_creation),
      raw.input_tokens_details?.cache_creation_tokens,
      raw.input_tokens_details?.cache_write_tokens,
      raw.inputTokenDetails?.cacheWriteTokens,
    ) ?? 0);

  if (additiveCacheTokens > 0) {
    inputTokens.uncached = baseInputTotal;
    inputTokens.total = baseInputTotal + additiveCacheTokens;
    return;
  }

  if (cacheParts > 0 && inputTokens.uncached === undefined) {
    inputTokens.uncached = Math.max(0, inputTokens.total - cacheParts);
  }
}

function applyModalityDetails(
  bucket: ProviderTokenBucket,
  details: unknown,
  direction: "input" | "output",
) {
  if (!Array.isArray(details)) return;

  for (const detail of details) {
    const anyDetail = asRecord(detail);
    if (!anyDetail) continue;
    const tokens = firstNumber(
      anyDetail.tokenCount,
      anyDetail.token_count,
      anyDetail.tokens,
    );
    if (tokens === undefined || tokens <= 0) continue;

    const modality = String(
      anyDetail.modality ?? anyDetail.type ?? anyDetail.name ?? "",
    ).toLowerCase();
    const key = modalityKey(modality, direction);
    bucket[key] = (bucket[key] ?? 0) + tokens;
  }
}

function cacheCreationTotal(value: unknown): number | undefined {
  const direct = numeric(value);
  if (direct !== undefined) return direct;

  const details = asRecord(value);
  if (!details) return undefined;

  const total = Object.values(details).reduce<number>(
    (sum, item) => sum + (numeric(item) ?? 0),
    0,
  );
  return total > 0 ? total : undefined;
}

function applyAnthropicCacheCreationDetails(
  inputTokens: ProviderTokenBucket,
  value: unknown,
) {
  const details = asRecord(value);
  if (!details) return;

  const ephemeral1h = firstNumber(details.ephemeral_1h_input_tokens);
  if (
    ephemeral1h !== undefined &&
    inputTokens.cacheCreationEphemeral1h === undefined
  ) {
    inputTokens.cacheCreationEphemeral1h = ephemeral1h;
  }

  const ephemeral5m = firstNumber(details.ephemeral_5m_input_tokens);
  if (
    ephemeral5m !== undefined &&
    inputTokens.cacheCreationEphemeral5m === undefined
  ) {
    inputTokens.cacheCreationEphemeral5m = ephemeral5m;
  }
}

function modalityKey(modality: string, direction: "input" | "output"): string {
  if (!modality) return direction === "output" ? "text" : "text";
  if (modality === "image") return "image";
  if (modality === "audio") return "audio";
  if (modality === "video") return "video";
  if (modality === "file") return "file";
  if (modality === "cache" || modality === "cached") return "cached";
  if (
    modality === "thought" ||
    modality === "thoughts" ||
    modality === "reasoning"
  ) {
    return "reasoning";
  }
  return modality;
}

function asRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as Record<string, any>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function cloneJsonSafe(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (value.rawUsage && typeof value.rawUsage === "object") {
    return cloneJsonSafe(value.rawUsage as Record<string, unknown>);
  }

  const { rawUsage: _rawUsage, ...safeValue } = value;
  if (isOnlyStandardUsageShape(safeValue)) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(safeValue));
  } catch {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(safeValue)) {
      if (
        item === null ||
        ["string", "number", "boolean"].includes(typeof item)
      ) {
        clone[key] = item;
      }
    }
    return Object.keys(clone).length ? clone : undefined;
  }
}

function isOnlyStandardUsageShape(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).filter((key) => value[key] !== undefined);
  return keys.length > 0 && keys.every((key) => STANDARD_USAGE_KEYS.has(key));
}

function numeric(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const amount = numeric(value);
    if (amount !== undefined) return amount;
  }
  return undefined;
}

function hasTokenData(
  inputTokens: ProviderTokenBucket,
  outputTokens: ProviderTokenBucket,
  total: number,
): boolean {
  return inputTokens.total > 0 || outputTokens.total > 0 || total > 0;
}
