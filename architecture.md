# LLM Providers — Architecture

> A single Enconvo extension that fronts **34 provider entry points** with a unified streaming interface, a centralized model registry, and a normalized reasoning-effort model. This document explains how the pieces fit together so a new contributor can find their bearings without reading 30+ files.

---

## 1. Mission, in one sentence

Take the zoo of LLM vendor APIs (OpenAI, Anthropic, Google, Azure, Ollama, MLX, Vercel Gateway, …), normalize them into **one Anthropic-shaped streaming contract**, and feed the rest of the Enconvo platform a single agent-friendly stream — regardless of which vendor produced it.

---

## 2. The big picture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Enconvo agent runtime                           │
│           (LLMProvider.handleAgentMessages — in @enconvo/api)         │
└──────────────────────────────────▲───────────────────────────────────┘
                                   │  Stream<BaseChatMessageChunk>
                                   │  (Anthropic-shaped SSE blocks)
                ┌──────────────────┴─────────────────┐
                │      this extension (`llm`)         │
                │                                     │
                │   ┌─────────────────────────────┐   │
                │   │ 34 provider entry points    │   │
                │   │ src/providers/*.ts          │   │
                │   └─────────────┬───────────────┘   │
                │                 │                   │
                │   ┌─────────────┴───────────────┐   │
                │   │  3 implementation engines   │   │
                │   │  • ChatOpenAIProvider       │   │
                │   │  • AnthropicProvider        │   │
                │   │  • GoogleGeminiProvider     │   │
                │   │  + a few specialty ones     │   │
                │   └─────────────┬───────────────┘   │
                │                 │                   │
                │   ┌─────────────┴───────────────┐   │
                │   │  shared utils               │   │
                │   │  • *_util.ts (per family)   │   │
                │   │  • model_registry.ts        │   │
                │   │  • reasoning_effort_data.ts │   │
                │   │  • usage_util.ts            │   │
                │   │  • http_client.ts           │   │
                │   └─────────────┬───────────────┘   │
                └─────────────────┼───────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │   Vendor APIs (OpenAI, Anthropic,  │
                │   Google, Azure, local Ollama/MLX, │
                │   Vercel Gateway, ChatGPT-Codex …) │
                └────────────────────────────────────┘
```

---

## 3. Repository layout

```
src/
├── providers/                  34 entry points (one per vendor)
│   ├── open_ai.ts              ◀── canonical OpenAI-compatible engine
│   ├── anthropic.ts            ◀── canonical Anthropic engine
│   ├── gemini.ts               ◀── canonical Google engine
│   ├── azure_openai.ts         own engine, AzureOpenAI SDK
│   ├── vercel_ai_gateway.ts    own engine, `ai` + `@ai-sdk/gateway`
│   ├── enconvo_ai.ts           ROUTER — dispatches to one of the engines above
│   ├── mlx.ts                  local Apple Silicon MLX, OpenAI-compat shim
│   ├── 1minai.ts               own engine, custom HTTP/SSE
│   ├── aimagicx.ts             own engine, custom HTTP/SSE
│   ├── straico.ts              extends ChatOpenAIProvider, file-upload twist
│   ├── cloudflare.ts           STUB (throws Not implemented)
│   ├── hermes.ts / openclaw.ts thin shim that normalizes baseUrl, then OpenAI engine
│   ├── ollama.ts               injects "ollama" apiKey, then Anthropic engine
│   └── (20 others)             5-line shims → one of the canonical engines
│
├── api/
│   ├── models/                 29 model-list fetchers (one per provider)
│   ├── local_provider_start.ts start/stop local providers (Ollama, MLX, LM Studio)
│   ├── local_provider_status.ts
│   ├── on_app_started.ts       boot hook
│   ├── openai-test/            (test scripts)
│   └── test.ts
│
├── utils/                      shared infra
│   ├── model_registry.ts       litellm-fed cache (2600+ models)
│   ├── reasoning_effort_data.ts per-model reasoning-effort UI profile
│   ├── openai_util.ts          message + tool + stream conversion
│   ├── anthropic_util.ts       message + tool + stream conversion
│   ├── google_util.ts          message + tool + stream conversion
│   ├── vercel_ai_gateway_util.ts
│   ├── aimagicx_util.ts / minai_util.ts
│   ├── usage_util.ts           normalize token-usage across vendors
│   ├── http_client.ts          dispatched fetch + retry helpers
│   ├── instructions.ts         prompt templates (e.g. Codex)
│   ├── claude_models_data.ts   static fallback (no-internet)
│   ├── openai_models_data.ts   static OAuth/Codex fallback
│   ├── qwen_models_data.ts     static
│   ├── model_registry.ts       central data
│   ├── text_utils.ts / message_utils.ts / errors.ts / context_item_util.ts
│   └── gemini-cli/             vendored helpers for Google Code-Assist OAuth
│
├── skills/SKILL.md             agent-facing endpoint catalogue
└── assets/                     vendor icons
```

---

## 4. Three engines do most of the work

The 34 files in `src/providers/` look like a lot, but ~20 of them are 5-line wrappers. There are really **three canonical engines** plus a few specialty ones.

| Engine | File | Wraps it | Notes |
|---|---|---|---|
| `ChatOpenAIProvider` | `open_ai.ts` | `arli`, `cerebras`, `cohere`, `dashscope`, `fireworks`, `groq`, `lm_studio`, `mistral`, `openrouter`, `poe`, `qwen`, `sambanova`, `siliconflow`, `together_ai`, `x_ai`, `straico` (extends), `hermes`, `openclaw` | OpenAI Chat Completions + Responses API, plus ChatGPT-Codex OAuth flow |
| `AnthropicProvider` | `anthropic.ts` | `deepseek`, `minimax`, `moonshot`, `ollama`, `xiaomi_mimo`, `z_ai` | Anthropic Messages SDK with terminated-socket retry |
| `GoogleGeminiProvider` | `gemini.ts` | (used directly only) | `@google/genai` SDK with Code-Assist OAuth fallback |

Specialty engines that don't share a base:

| Engine | File | Why it's its own class |
|---|---|---|
| Azure OpenAI | `azure_openai.ts` | needs `AzureOpenAI` SDK + endpoint/version/deployment triplet |
| Vercel AI Gateway | `vercel_ai_gateway.ts` | uses `ai` SDK and `streamText`, multiplexes provider-options inline |
| MLX | `mlx.ts` | local Apple-Silicon route + vision-model auto-detection |
| 1minAI | `1minai.ts` | proprietary `/api/features` endpoint, not OpenAI-compatible |
| AIMagicX | `aimagicx.ts` | proprietary `/chat` endpoint with custom SSE parsing |
| Cloudflare | `cloudflare.ts` | **stub — `Method not implemented`** |
| `enconvo_ai` | `enconvo_ai.ts` | **router**, not an engine — see §6 |

---

## 5. The unified streaming contract

> This is the spine of the whole extension. Every engine's `_stream()` must produce a `Stream<BaseChatMessageChunk>` shaped like an Anthropic SSE flow. The Enconvo agent runtime then consumes any provider's output identically.

### Block lifecycle

```
content_block_start    // opens a block: text | thinking | tool_use | …
content_block_delta*   // 0..N incremental updates
content_block_stop     // closes the block, optionally with finish_reason
…repeat for next block…
usage                  // once per stream, terminal
```

### Delta types

| Delta | Carries |
|---|---|
| `text_delta` | streamed text |
| `thinking_delta` | reasoning trace |
| `signature_delta` | thinking-block signature (Anthropic) |
| `input_json_delta` | streamed tool-call arguments (partial JSON) |

### Special signals

- `content_block_stop` may include `finish_reason: 'max_tokens'` → the consumer auto-appends a "continue" user message and loops.
- The consumer tracks **one** running content-block type and **one** pending tool at a time. Providers that natively emit parallel tool calls must collapse to the first one (or set `parallel_tool_calls: false` upstream).

### Provider-side responsibilities

Each `*_util.ts` translates the vendor's native stream into this contract. Concretely:

- thinking → `start(thinking) → delta(thinking_delta) → stop`
- text → `start(text) → delta(text_delta) → stop`
- tool call → `start(tool_use, {name, input, id}) → delta(input_json_delta)? → stop`
- token usage → terminal `usage` chunk
- max-tokens stop → `stop` with `finish_reason: 'max_tokens'`
- abort signals → cleanup in `finally`

---

## 6. Enconvo Cloud routing (`enconvo_ai.ts`)

`enconvo_ai` is **not** an engine — it's a thin router that:

1. Inspects `modelName` (format `{providerKey}/{modelId}`, e.g. `anthropic/claude-3-7-sonnet`).
2. Sets `options.commandName` to the right backing provider.
3. Rewrites `credentials.anthropicApiUrl` / `credentials.baseUrl` to the Enconvo gateway:
   - `https://api.enconvo.com/` → for Anthropic-compatible vendors
   - `https://api.enconvo.com/v1/` → for OpenAI-compatible vendors
   - `https://api.enconvo.com` → for Google Gemini
4. Calls `LLMProvider.fromOptions(options)`, which re-resolves the provider chain — landing in `anthropic.ts`, `open_ai.ts`, or `gemini.ts` as appropriate.

The downstream engines detect the routing via `options.originCommandName === "enconvo_ai"` and inject extra auth headers (`accessToken`, `client_id`, `commandKey`, `commandTitle`, `modelName`) so the gateway can attribute usage to the correct user/command.

> **Adding a new model to Enconvo Cloud touches three repos** — see `AGENTS.md` for the cross-repo checklist (`distribution/modles/enconvo.json`, `enconvo_ai.ts`, `enconvo-api-workers/OpenAIController.ts`).

---

## 7. The Model Registry (`utils/model_registry.ts`)

A single source of truth for **everything model-shaped**: pricing, context window, capability flags (vision / tool-use / audio / video / reasoning).

- **Source**: [`BerriAI/litellm/model_prices_and_context_window.json`](https://github.com/BerriAI/litellm) — 2600+ models.
- **Cache**: disk at `~/.cache/enconvo/llm-registry/` with **stale-while-revalidate**:
  - serve cache if < 24h old (fast path, no network)
  - revalidate via ETag / If-Modified-Since at 24h–7d
  - refetch unconditionally past 7d
- **API**: `await initRegistry()` once at boot, then `await getModel(modelId)` — O(1) lookup.

Every `api/models/*.ts` enriches the vendor's raw model list with registry data and a reasoning-effort profile, so the UI dropdown gets the right pricing string and capability badges without each provider hardcoding them.

---

## 8. Reasoning Effort (`utils/reasoning_effort_data.ts`)

Each vendor exposes "let the model think harder" differently:

| Vendor | Surface |
|---|---|
| OpenAI | `low` / `medium` / `high` / `minimal` |
| Anthropic | token budgets (`thinking.budget_tokens`) or `effort` levels (`adaptive`) |
| Gemini ≤ 2.5 | numeric `thinkingBudget` (`-1` = auto, `0` = off) |
| Gemini 3 | `thinkingLevel: low | medium | high` |
| Ollama | enabled / disabled boolean |

`reasoning_effort_data.ts` keeps a **single mapping** from model ID prefix → preference profile. `getReasoningEffortPreference(modelId, provider?)` returns the right dropdown definition for the UI. Providers then read the chosen value and translate it to their native shape inside `initParams()`.

---

## 9. Authentication patterns

Three patterns recur across providers:

1. **API key** — `credentials.apiKey` → SDK constructor. Used by ~80% of providers.
2. **OAuth2** — three flavours:
   - Anthropic Console OAuth → `CredentialsProvider.create("anthropic").load()` returns `{access_token}`, sent via `authToken` SDK option + extra `anthropic-beta` headers.
   - ChatGPT Codex OAuth → custom OpenAI client with hardcoded `apiKey: "key"`, real auth in `Authorization` header, custom `fetch` rewrites URL to `https://chatgpt.com/backend-api/codex/responses`.
   - Google Code-Assist OAuth → `getCodeAssistServer()` from the vendored `gemini-cli/` toolkit; `_call`/`_stream` dispatch to `this.server` instead of `this.ai`.
   - Qwen OAuth → `CredentialsProvider.create("qwen").authenticate()` (refreshes), then dynamic `baseURL` from `credentials.resource_url`.
3. **Local proxy** — Ollama, LM Studio, MLX, Hermes, OpenClaw all hit `http://127.0.0.1:<port>/v1` with a fake or constant API key. `mlx.ts` additionally rewrites every fetch via a custom `fetch` to dispatch to `mlx_manage/{lm,vlm}/openai_chat_completions` on the local Enconvo HTTP API.

---

## 10. Usage tracking (`utils/usage_util.ts`)

Every provider must terminate its stream with a `usage` chunk in the same shape, regardless of native format. `usage_util.ts` exposes:

- `usageFromOpenAIChatUsage(...)` — reads OpenAI `usage`
- `usageFromGoogleUsageMetadata(...)` — reads `usageMetadata.candidatesTokenCount`, etc.
- `usageFromResponseEnvelope(...)` — for vendors that wrap usage in `{success, data: {usage}}` (1minAI, AIMagicX)
- `normalizeProviderUsage(...)` — final normalization to `{input_tokens, output_tokens, cache_*}`
- `additionalWithProviderUsage(existing, usage)` — merges into `BaseChatMessage.additional.metadata.providerUsage` for the non-streaming `_call()` path

This is also the contract `LLMProvider`'s context-compression layer reads when deciding whether to summarize history.

---

## 11. Local providers (`api/local_provider_*.ts`)

Three providers run locally on the user's Mac:

| Provider | Manager | Default URL |
|---|---|---|
| Ollama | system service | `http://127.0.0.1:11434/v1` |
| LM Studio | desktop app | configurable |
| MLX | `mlx_manage` extension | `http://localhost:54535/mlx_manage/...` |

- `local_provider_start.ts` — start/stop the underlying server
- `local_provider_status.ts` — installed? running?

The MLX path is interesting: `mlx.ts` constructs an OpenAI client whose `fetch` rewrites every request URL into a local Enconvo HTTP API call (`mlx_manage/mlx_lm/openai_chat_completions` for text, `mlx_manage/mlx_vlm/openai_chat_completions` for vision). This way, MLX models speak the OpenAI Chat Completions wire format end-to-end and reuse `OpenAIUtil` unchanged.

---

## 12. Adding a new provider

The well-trodden path:

1. **Pick an engine.** OpenAI-compatible API? → 5-line shim around `ChatOpenAIProvider`. Anthropic-compatible? → wrap `AnthropicProvider`. Custom protocol? → write your own (use `1minai.ts` / `aimagicx.ts` as templates).
2. **Create `src/providers/<name>.ts`** — `default function main(options) { return new TheEngine(options); }`.
3. **Create `src/api/models/<name>.ts`** — call the vendor's `/models` endpoint (or import a static list), enrich each model via `getModel(...)` from `model_registry.ts`, attach a reasoning-effort preference via `getReasoningEffortPreference(...)`.
4. **Add a command entry to `package.json`** — Enconvo discovers the provider via the commands array; include credential type, model dropdown (`dataProxy: "llm/<name>_models"`), temperature, etc.
5. **Drop a 256×256 PNG icon into `assets/`**.
6. **(Optional) Add a `<name>_util.ts`** if message/tool/stream conversion needs custom logic.

For **Enconvo Cloud routing**, additionally:
- add a `case` to the switch in `enconvo_ai.ts`
- update `distribution/modles/enconvo.json` (model entry + R2 sync)
- update `enconvo-api-workers/OpenAIController.ts` (pricing map, routing, usage tracking, env type)

---

## 13. Where to start when debugging

| Symptom | First place to look |
|---|---|
| "Wrong" reply / no streaming | the relevant `*_util.ts` — that's where vendor → unified-stream translation happens |
| Model dropdown shows stale capabilities | `utils/model_registry.ts` cache; bust `~/.cache/enconvo/llm-registry/` |
| Reasoning toggle does nothing | `utils/reasoning_effort_data.ts` — verify a profile is mapped to the model ID prefix |
| Token usage not showing | the engine's `usage` emission + `usage_util.ts` shape |
| Cancellation doesn't actually cancel | the engine's `AbortSignal` plumbing — common bug, see provider review notes |
| OAuth user gets "API key required" | the engine's credential-validation guard, especially `anthropic.ts` `_stream()` |
| Tool call ignored | OpenAI engine forces `parallel_tool_calls: false`; verify `tool_choice` and `toolUse` flag |
| Image / audio output missing | engine's `_call()` parses `inlineData` / `images` arrays — see `gemini.ts` and `open_ai.ts` |
| Local provider unreachable | `api/local_provider_status.ts` first; MLX additionally needs `mlx_manage` extension running |

---

## 14. Known sharp edges

These came out of the recent code review and are worth flagging in the architecture doc so newcomers don't trip on them:

- **`anthropic.ts` `_stream()` credential guard** rejects OAuth users (it only checks `apiKey` / `access_token`, but OAuth tokens live on `oauthCredentials` loaded inside `initClient()`).
- **`open_ai.ts` Straico shortcut** in `_stream` returns a `BaseChatMessage` instead of a stream — anyone iterating it crashes.
- **`gemini.ts` `webFetchToolEnabled` branch is unreachable** (`if (!tools)` is always false because `tools` is initialized as `[]`).
- **`gemini.ts` `_stream` ignores `content.signal`** — passes a fresh `AbortController` to `streamFromGoogle`, so cancellation is a no-op.
- **Hardcoded session IDs** appear in `open_ai.ts` (`session_id: "a55064f6-..."`) and `gemini.ts` (`sessionId: "Enconvo"`) — every user shares the same identifier.
- **`cloudflare.ts` is a stub.** The class throws `Method not implemented` on both `_call` and `_stream`. The package.json command pretending to support Cloudflare Workers AI is inert.
- **`mutating shared options`** in OpenAI provider's `o1-mini` branch and `127.0.0.1:5001` branch — both are dead code that mutate `this.options`.
- **`enconvo_ai.ts` mutates `options.credentials!`** — relies on credentials existing; will throw on null deref if a misconfigured user reaches the router.

These are tracked in the per-provider review threads (`anthropic.ts`, `open_ai.ts`, `gemini.ts`) for prioritized fixing.

---

## 15. Summary

- **34 provider files**, but really **3 canonical engines** + a handful of specialties + 1 router.
- **One streaming contract** (Anthropic-shaped SSE blocks) to which every engine conforms.
- **One model registry** (litellm-fed, stale-while-revalidate).
- **One reasoning-effort abstraction** that hides per-vendor surface differences.
- **Two concerns kept out of providers**: context-compression (lives in `@enconvo/api`'s `LLMProvider` base) and UI configuration (lives in `package.json` commands array).

The result is that the rest of the Enconvo platform — the agent loop, the chat UI, the cron scheduler, the channel bots — never has to know what vendor produced a given chunk.
