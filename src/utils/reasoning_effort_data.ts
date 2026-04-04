// Centralized reasoning effort preference definitions per model.
//
// Different providers and models support different reasoning effort options.
// This file maps model ID patterns to their specific reasoning effort config,
// so each *_models.ts can look up the right preference via getReasoningEffortPreference().

// ============================================================================
// Types
// ============================================================================

interface ReasoningEffortOption {
  title: string;
  value: string;
  description: string;
}

interface ReasoningEffortProfile {
  default: string;
  data: ReasoningEffortOption[];
}

// ============================================================================
// Profiles — each represents a distinct set of reasoning effort options
// ============================================================================

const profiles = {
  /** OpenAI GPT-5.4 / GPT-5.3 series: none → xhigh */
  openai_5_levels: {
    default: "none",
    data: [
      { title: "None", value: "none", description: "No reasoning" },
      { title: "Low", value: "low", description: "Basic reasoning" },
      { title: "Medium", value: "medium", description: "Medium reasoning" },
      { title: "High", value: "high", description: "High reasoning" },
      { title: "X-High", value: "xhigh", description: "Extra high reasoning" },
    ],
  },

  /** OpenAI GPT-5.1 / GPT-5.2 series: none → xhigh with minimal */
  openai_6_levels: {
    default: "none",
    data: [
      { title: "None", value: "none", description: "No reasoning" },
      { title: "Minimal", value: "minimal", description: "Minimal reasoning" },
      { title: "Low", value: "low", description: "Basic reasoning" },
      { title: "Medium", value: "medium", description: "Medium reasoning" },
      { title: "High", value: "high", description: "High reasoning" },
      { title: "X-High", value: "xhigh", description: "Extra high reasoning" },
    ],
  },

  /** OpenAI GPT-5 base / o-series: minimal → high */
  openai_4_levels: {
    default: "minimal",
    data: [
      { title: "Minimal", value: "minimal", description: "Minimal reasoning" },
      { title: "Low", value: "low", description: "Basic reasoning" },
      { title: "Medium", value: "medium", description: "Medium reasoning" },
      { title: "High", value: "high", description: "High reasoning" },
    ],
  },

  /** Anthropic Claude: thinking budget in tokens */
  anthropic_budget: {
    default: "none",
    data: [
      { title: "None", value: "none", description: "Model does not think" },
      { title: "Minimal", value: "1024", description: "Thinking budget tokens: 1024" },
      { title: "Low", value: "2048", description: "Thinking budget tokens: 2048" },
      { title: "Medium", value: "5120", description: "Thinking budget tokens: 5120" },
      { title: "High", value: "10240", description: "Thinking budget tokens: 10240" },
    ],
  },

  /** Gemini: minimal → high */
  gemini_4_levels: {
    default: "minimal",
    data: [
      { title: "Minimal", value: "minimal", description: "Minimal thinking level" },
      { title: "Low", value: "low", description: "Low thinking level" },
      { title: "Medium", value: "medium", description: "Medium thinking level" },
      { title: "High", value: "high", description: "High thinking level" },
    ],
  },

  /** DeepSeek / Groq: low → high */
  standard_3_levels: {
    default: "low",
    data: [
      { title: "Low", value: "low", description: "Favors speed and economical token usage with basic reasoning" },
      { title: "Medium", value: "medium", description: "Balance between speed and reasoning accuracy (default)" },
      { title: "High", value: "high", description: "Favors more complete reasoning with higher token usage" },
    ],
  },

  /** Ollama: simple on/off toggle */
  ollama_toggle: {
    default: "disabled",
    data: [
      { title: "None", value: "disabled", description: "Disabled" },
      { title: "Thinking", value: "enabled", description: "Enabled" },
    ],
  },
} as const satisfies Record<string, ReasoningEffortProfile>;

// ============================================================================
// Model → profile mapping
//
// Each entry maps a model ID prefix to a profile.
// Entries are checked in order — first match wins.
// More specific prefixes must come before less specific ones.
// ============================================================================

interface ModelMapping {
  /** Model ID prefix to match (case-insensitive startsWith) */
  prefix: string;
  /** Profile key from the profiles object */
  profile: keyof typeof profiles;
}

const modelMappings: ModelMapping[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────
  // GPT-5.4 series
  { prefix: "gpt-5.4",          profile: "openai_5_levels" },
  { prefix: "gpt-5.3",          profile: "openai_5_levels" },
  // GPT-5.2 / 5.1 series (with minimal + xhigh)
  { prefix: "gpt-5.2",          profile: "openai_6_levels" },
  { prefix: "gpt-5.1",          profile: "openai_6_levels" },
  // GPT-5 base series (must come after 5.x)
  { prefix: "gpt-5",            profile: "openai_4_levels" },
  // o-series reasoning models
  { prefix: "o3",               profile: "openai_4_levels" },
  { prefix: "o4",               profile: "openai_4_levels" },
  { prefix: "o1",               profile: "openai_4_levels" },

  // ── Anthropic ───────────────────────────────────────────────────────
  { prefix: "claude-",          profile: "anthropic_budget" },

  // ── Google Gemini ───────────────────────────────────────────────────
  { prefix: "gemini-",          profile: "gemini_4_levels" },

  // ── DeepSeek ────────────────────────────────────────────────────────
  { prefix: "deepseek-r1",      profile: "standard_3_levels" },
  { prefix: "deepseek-reasoner", profile: "standard_3_levels" },

  // ── Groq (GPT-OSS) ─────────────────────────────────────────────────
  { prefix: "openai/gpt-oss",   profile: "standard_3_levels" },

  // ── Ollama (all thinking-capable models) ────────────────────────────
  // Ollama models are handled differently — see getReasoningEffortPreference
  // with the provider parameter.
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Build the full reasoning_effort preference object for a model.
 * Returns undefined if the model doesn't support configurable reasoning effort.
 *
 * @param modelId  - The model identifier (e.g. "gpt-5.4", "claude-sonnet-4-20250514")
 * @param provider - Optional provider hint. Useful for disambiguating models that
 *                   exist on multiple providers (e.g. deepseek-r1 on Groq vs DeepSeek).
 *                   Pass "ollama" to get the ollama toggle profile.
 *
 * @example
 * ```ts
 * const pref = getReasoningEffortPreference("gpt-5.4");
 * // { name: "reasoning_effort", type: "dropdown", default: "none", data: [...5 options] }
 *
 * const pref = getReasoningEffortPreference("claude-sonnet-4-20250514");
 * // { name: "reasoning_effort", ..., data: [none, 1024, 2048, 5120, 10240] }
 *
 * const pref = getReasoningEffortPreference("qwen3:32b", "ollama");
 * // { name: "reasoning_effort", ..., data: [disabled, enabled] }
 * ```
 */
export function getReasoningEffortPreference(
  modelId: string,
  provider?: string,
): {
  name: string;
  description: string;
  type: "dropdown";
  required: false;
  title: string;
  default: string;
  data: ReasoningEffortOption[];
} | undefined {
  // Ollama always uses the simple toggle
  if (provider === "ollama") {
    return buildPreference(profiles.ollama_toggle);
  }

  const idLower = modelId.toLowerCase();

  for (const mapping of modelMappings) {
    if (idLower.startsWith(mapping.prefix.toLowerCase())) {
      return buildPreference(profiles[mapping.profile]);
    }
  }

  return undefined;
}

function buildPreference(profile: ReasoningEffortProfile) {
  return {
    name: "reasoning_effort",
    description:
      "Applicable to reasoning models only, this option controls the reasoning token length.",
    type: "dropdown" as const,
    required: false as const,
    title: "Reasoning Effort",
    default: profile.default,
    data: profile.data as unknown as ReasoningEffortOption[],
  };
}
