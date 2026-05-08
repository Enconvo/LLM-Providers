# Context Compression Provider Contract

Context compression is owned by the Enconvo SDK `LLMProvider`, not by individual
provider implementations in this module. Providers should stay compression-free
and preserve the information the SDK needs to make compression decisions.

## Provider Requirements

- Model context windows must come from `src/utils/model_registry.ts` or the
  provider's authoritative model metadata. Do not hardcode smaller fallback
  values unless the upstream source is unavailable.
- Provider `_call()` and `_stream()` implementations should preserve upstream
  context-limit errors. Keep status codes, error codes, and text such as
  "context window", "prompt too large", or "input length exceeded" in the thrown
  error message.
- Message conversion utilities must keep Enconvo `flow_step` semantics stable:
  tool names, tool IDs, arguments, and tool results must remain paired after
  conversion.
- Streaming providers should emit usage chunks when the upstream API provides
  token usage. Normalize usage with `src/utils/usage_util.ts` before yielding.
  The SDK records these in assistant message consumption metadata and uses
  returned `outputTokens.total` before character estimation for future assistant
  message token estimates.
- Non-streaming `_call()` implementations should attach upstream usage to the
  returned assistant message at `additional.metadata.providerUsage` when usage
  is available. Use `additionalWithProviderUsage()` so `_call()` returns the
  same shape as `_stream()`.
- Provider usage should use the normalized shape shown below. The helper accepts
  provider-native legacy fields as input, but it does not mirror them into the
  normalized output.

```json
{
  "inputTokens": {
    "total": 1150,
    "uncached": 800,
    "cached": 200,
    "cacheCreation": 150,
    "cacheCreationEphemeral1h": 100,
    "cacheCreationEphemeral5m": 50,
    "image": 0,
    "audio": 0
  },
  "outputTokens": {
    "total": 120,
    "reasoning": 40,
    "acceptedPrediction": 0,
    "rejectedPrediction": 0,
    "audio": 0
  },
  "total": 1270,
  "serviceTier": "standard_only",
  "rawUsage": {}
}
```

`inputTokens.total` is the full input token count and includes normal prompt
tokens plus cache-read/cache-created prompt tokens. Cache parts remain available
separately as `inputTokens.cached` and `inputTokens.cacheCreation`; when known,
`inputTokens.uncached` records the non-cache prompt portion.
Provider-native usage is also preserved in `rawUsage` so new or provider-specific
fields are not lost.

Supported provider source shapes include:

- OpenAI Chat Completions: `prompt_tokens`, `completion_tokens`,
  `total_tokens`, `prompt_tokens_details.cached_tokens/audio_tokens`, and
  `completion_tokens_details.reasoning_tokens/audio_tokens`,
  `accepted_prediction_tokens`, `rejected_prediction_tokens`, and
  `service_tier`. OpenAI prompt/input token totals already include cached
  tokens; cached fields are breakdown only and are not added a second time.
- OpenAI Responses-compatible usage: `input_tokens`, `output_tokens`,
  `input_tokens_details`, and `output_tokens_details`.
- OpenAI Usage API: `input_tokens` and `input_cached_tokens`, where
  `input_tokens` is inclusive and `input_cached_tokens` is a breakdown.
- Anthropic Messages: `input_tokens`, `output_tokens`,
  `cache_read_input_tokens`, `cache_creation_input_tokens`, `cache_creation`,
  and `service_tier`. Anthropic input totals are normalized as
  `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.
- Anthropic Admin usage: `uncached_input_tokens`, `cache_read_input_tokens`,
  `cache_creation`, `cache_creation_input_tokens`, and `output_tokens`.
  `cache_creation.ephemeral_1h_input_tokens` and
  `cache_creation.ephemeral_5m_input_tokens` are preserved separately.
- Gemini: `usageMetadata.promptTokenCount`, `candidatesTokenCount`,
  `totalTokenCount`, `cachedContentTokenCount`, `thoughtsTokenCount`, and
  modality detail arrays.
- Vercel AI SDK: `totalUsage.inputTokens`, `outputTokens`, `totalTokens`,
  `inputTokenDetails`, and `outputTokenDetails`.

Current emitters using the shared normalizer:

- OpenAI-compatible providers, including OpenAI, OpenRouter, Groq, Mistral,
  Cerebras, DashScope, Qwen, LM Studio, Hermes, OpenClaw, and MLX.
- Anthropic-compatible providers, including Anthropic, MiniMax, Z.AI, Moonshot,
  DeepSeek, Xiaomi MiMo, and Ollama.
- Gemini and Enconvo Cloud Gemini routing.
- Azure OpenAI.
- Vercel AI Gateway.
- Custom direct providers when the upstream response includes a recognizable
  usage envelope.

`outputTokens.total` represents generated assistant content and can be used as
the assistant message token override. `inputTokens.total` and `total` are
request-level usage. They must not be interpreted as the token size of the
returned assistant message. For context compaction summaries, the SDK prefers
`contextCompaction.tokenOverride`, then `outputTokens.total`, then normal token
estimation.

## What Providers Should Not Do

- Do not summarize, delete, or truncate conversation history inside a provider.
- Do not hide context-overflow errors behind a generic authentication or network
  error.
- Do not change model context metadata to compensate for provider-specific token
  counting. The SDK estimator already applies a safety margin.

When a request is too large, the SDK will summarize older model context, persist
the compaction overlay through `message_manager`, and retry the provider call.

## Provider Docs Checked

- OpenAI Chat Completions usage:
  https://platform.openai.com/docs/api-reference/chat
- OpenAI Responses usage:
  https://platform.openai.com/docs/api-reference/responses
- OpenAI prompt caching:
  https://platform.openai.com/docs/guides/prompt-caching
- Anthropic prompt caching:
  https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Anthropic service tiers:
  https://docs.anthropic.com/en/api/service-tiers
- Anthropic Messages usage report:
  https://docs.anthropic.com/en/api/admin-api/usage-cost/get-messages-usage-report
