# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an Enconvo Extension that provides LLM (Large Language Model) providers for the Enconvo platform. It offers a unified interface for interacting with 20+ AI providers including OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, and many others.

## Development Commands

### Package Management
- `pnpm install` - Install dependencies (uses pnpm, not npm)

### Development 
- `npm run dev` or `enconvo --dev` - Start development server
- `npm run build` or `enconvo` - Build the extension

### Code Quality
- `npm run lint` - Run ESLint on src directory (must pass before committing)
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without changes

**IMPORTANT**: Always run `npm run lint` and `npm run format:check` before committing changes to ensure code quality standards are met.

### Testing API Endpoints

After building, test API endpoints via the local HTTP API (port 54535):
```bash
curl -X POST http://localhost:54535/api/llm/{endpoint} \
    -H "Content-Type: application/json" -d '{}'
```

## Architecture

### Core Structure
- **Provider Pattern**: Each AI service is implemented as a separate provider class extending `LLMProvider` from `@enconvo/api`
- **Chat Interface**: All providers implement `_call()` and `_stream()` methods for sync and async chat completions
- **Model Management**: Dynamic model fetching and caching system for each provider
- **Utility Layer**: Shared utilities for message conversion, token counting, and provider-specific transformations

### Key Directories
- `src/` - Main source code
  - `api/models/` - Model list fetchers for each provider (e.g., `openai.ts`, `anthropic.ts`)
  - `providers/` - Chat provider implementations (e.g., `chat_open_ai.ts`, `chat_anthropic.ts`)
  - `utils/` - Shared utilities
    - `model_registry.ts` - **Central model data registry** backed by litellm's 2600+ model database with stale-while-revalidate caching
    - `reasoning_effort_data.ts` - **Centralized reasoning effort profiles** per model/provider
    - `openai_util.ts` - OpenAI-specific utilities
    - `anthropic_util.ts` - Anthropic-specific utilities
    - `google_util.ts` - Google-specific utilities
    - `openai_models_data.ts` - Static OpenAI codex model data (oauth2 fallback)
- `assets/` - Provider icons and images

### Provider Implementation Pattern
Each provider follows this structure:
1. **Main Class**: Extends `LLMProvider` with provider-specific configuration
2. **Authentication**: Handles API keys, base URLs, and custom headers
3. **Message Conversion**: Transforms Enconvo messages to provider-specific format
4. **Streaming Support**: Implements real-time response streaming
5. **Tool Support**: Handles function calling where supported
6. **Model Management**: Dynamic model fetching and caching

### Configuration System
- `package.json` contains extensive command definitions with preferences
- Each provider has its own credential management system
- Models are fetched dynamically or from static data
- Temperature and other parameters are configurable per provider

### Key Integrations
- **LangSmith**: Tracing support when `LANGCHAIN_TRACING_V2=true`
- **LangChain**: Used for some providers (Cohere, Cloudflare)
- **Enconvo API**: Core platform integration via `@enconvo/api`

## Provider-Specific Notes

### Special Providers
- **Enconvo Cloud**: Uses special authentication headers and model prefixes
- **Azure OpenAI**: Requires endpoint, API version, and deployment name
- **Ollama**: Local model support with custom base URL
- **LM Studio**: Local OpenAI-compatible API

### Model Data Architecture
- **Model Registry** (`utils/model_registry.ts`): All model files use a centralized registry backed by [litellm/model_prices_and_context_window.json](https://github.com/BerriAI/litellm). Provides context window, pricing, capabilities (vision, tool use, audio, video, reasoning, etc.) for 2600+ models.
  - **Caching**: Disk cache at `~/.cache/enconvo/llm-registry/` with stale-while-revalidate (24h stale, 7d expire, ETag/If-Modified-Since conditional requests).
  - **Usage**: `await initRegistry()` once, then `await getModel(modelId)` for O(1) lookups.
- **Reasoning Effort** (`utils/reasoning_effort_data.ts`): Centralized reasoning effort preference profiles. Different models support different reasoning controls (e.g., OpenAI uses low/medium/high, Anthropic uses token budgets, Gemini 2.5 uses auto/budget tokens).
  - **Usage**: `getReasoningEffortPreference(modelId, provider?)` returns the correct dropdown preference or `undefined`.
  - **Adding models**: Add a `prefix → profile` entry in `modelMappings`, or add a new profile in `profiles`.
- **Model Fetching**: Each provider's `api/models/*.ts` fetches from the provider API (or uses static lists), then enriches with registry data and reasoning effort preferences.
- Models are cached using `ListCache` from Enconvo API

### Unified Streaming Architecture

All providers convert their native stream format into an **Anthropic-like `Stream<BaseChatMessageChunk>`** format. The unified consumer in `enconvo.nodejs` (`LLMProvider.handleAgentMessages()`) then processes these normalized chunks identically, regardless of which provider produced them.

```
Provider SDK stream (native format)
    ↓  each provider's _stream() + util
Stream<BaseChatMessageChunk>  (Anthropic SSE format)
    ↓  consumed by LLMProvider.handleAgentMessages()
UI updates (res.write) + agent loop (tool execution → next turn)
```

**Stream format contract** — each content block follows this sequence:
1. `content_block_start` — opens a block (`text`, `thinking`, `tool_use`, `server_tool_use`, `server_tool_use_result`, `message_content`)
2. `content_block_delta` (0..N) — incremental updates:
   - `text_delta` — text content
   - `thinking_delta` — reasoning trace
   - `signature_delta` — thinking block signature (Anthropic)
   - `input_json_delta` — streamed tool call arguments (partial JSON)
3. `content_block_stop` — closes the block; may include `finish_reason: 'max_tokens'` to trigger continuation
4. `usage` — token counts (once per stream, from the final chunk)

**Consumer behavior** (`handleAgentMessages`):
- Tracks one `runningContentBlockType` and one `toBeRunTool` at a time
- On `content_block_stop` for `tool_use`: parses accumulated `arguments_delta`, executes the tool, appends result to messages, and loops for the next agent step
- On `finish_reason: 'max_tokens'`: appends a "continue" user message and loops
- Accumulates `thinking_delta` into `ChatMessageContentThinking` with timing
- Each provider util must emit the correct block sequence for the consumer to work

**Provider implementation guide** — each `*_util.ts` must:
- Map native thinking → `content_block_start(thinking)` + `content_block_delta(thinking_delta)` + `content_block_stop`
- Map native text → `content_block_start(text)` + `content_block_delta(text_delta)` + `content_block_stop`
- Map native tool calls → `content_block_start(tool_use, {name, input, id})` + optional `content_block_delta(input_json_delta)` + `content_block_stop`
- Map native token usage → `usage` chunk
- Map max-tokens stop → `content_block_stop` with `finish_reason: 'max_tokens'`
- Handle abort signals and yield proper cleanup in `finally` blocks

## TypeScript Configuration

- Strict TypeScript with modern ES2021+ features
- Path mapping configured for `@/*` imports
- Source maps enabled for debugging
- Experimental decorators enabled
- No unused locals/parameters enforcement

## Adding New AI Providers

When adding a new AI provider, follow this established pattern:

1. **Main Provider File**: Create `src/providers/chat_[provider].ts` extending `LLMProvider`
2. **Model Fetcher**: Create `src/api/models/[provider].ts` for dynamic model lists — use `model_registry.ts` for data enrichment and `reasoning_effort_data.ts` for reasoning preferences
3. **Utility Functions**: Add provider-specific utilities in `src/utils/[provider]_util.ts` if needed
4. **Package.json Command**: Add command configuration in `package.json` commands array
5. **Icon**: Add provider icon to `assets/` directory

### Required Implementation
Each provider must implement:
- `_call()` method for synchronous chat completion
- `_stream()` method for streaming responses
- Proper error handling and authentication
- Message format conversion for the provider's API

### Provider Categories
- **OpenAI-Compatible**: OpenAI, Azure OpenAI, LM Studio, OpenRouter, Perplexity, SiliconFlow
- **Anthropic-Compatible**: Anthropic, MiniMax, Z.AI (wrap `AnthropicProvider`)
- **LangChain-Based**: Cohere, Cloudflare Workers AI  
- **Direct SDK**: Google Gemini, X.AI
- **Custom Implementation**: Enconvo Cloud, Ollama, DeepSeek, others

### Adding a Provider to Enconvo Cloud

Enconvo Cloud (`enconvo_ai`) is a proxy that routes requests through Enconvo's API gateway. Adding a model to the cloud plan requires changes across **3 repos**:

#### Step 1: Model list — `distribution/modles/enconvo.json`

Add the model entry with `providerName` matching the routing key. Points pricing: `$price / $0.00002 per point`.

```jsonc
{
  "title": "GLM-5",
  "value": "z_ai/glm-5",           // format: {providerKey}/{modelId}
  "providerName": "z_ai",           // must match the switch case in enconvo_ai.ts
  "context": 128000,
  "perRequestPrice": 50000,          // input: $1/1M tokens ÷ $0.00002 = 50,000 points
  "perRequestUnit": "1M input tokens , 160,000 points / 1M output tokens",
  "toolUse": true,
  "visionEnable": true,
  "searchToolSupported": true
}
```

After editing, run `sh upload-r2.sh` in the `distribution/` repo to sync to R2.

#### Step 2: Provider routing — `llm/src/providers/enconvo_ai.ts`

Add a `case` in the `switch (modelProvider)` block to route the provider key to the correct command and set the appropriate API URL:

```typescript
case "z_ai":
  options.commandName = "z_ai";
  options.credentials!.anthropicApiUrl = workerAnthropicApiUrl;
  break;
```

URL mapping:
- `workerAnthropicApiUrl` (`https://api.enconvo.com/`) — for Anthropic-compatible providers (Anthropic, MiniMax, Z.AI)
- `openAIBaseUrl` (`https://api.enconvo.com/v1/`) — for OpenAI-compatible providers
- `googleApiUrl` (`https://api.enconvo.com`) — for Google Gemini
- `anthropicApiUrl` (`https://api-v.enconvo.com/claude/`) — for direct Anthropic routing

#### Step 3: API gateway — `enconvo-api-workers/src/controller/ai/OpenAIController.ts`

Three changes needed:

1. **Token pricing** — add model to `tokenPointsMap` (prices in $/1M tokens):
   ```typescript
   'glm-5': { input_price: 1, output_price: 3.2, cache_input_price: 0.2, cache_output_price: 0 },
   ```

2. **Request routing** — add `else if (modelProvider === 'z_ai')` block with the upstream API URL, auth headers, and model name extraction. Follow existing patterns (Anthropic-compatible uses `X-Api-Key` + `Anthropic-Version`; OpenAI-compatible uses `Authorization: Bearer`).

3. **Usage tracking** — ensure `handleStreamUsage` parses token usage for the new provider. Anthropic-compatible providers can be added to the existing `anthropic` branch condition.

4. **Env type** — add the API key to the `Env` interface in `enconvo-api-workers/index.ts` and set it as a Cloudflare Workers secret.

## Development Guidelines

- Use `pnpm install` for package management (not npm)
- Follow existing naming conventions: `src/providers/chat_[provider].ts` for providers
- Model files follow pattern: `src/api/models/[provider].ts`
- Use `model_registry.ts` for model data enrichment — never hardcode pricing, context windows, or capabilities
- Use `reasoning_effort_data.ts` for reasoning preferences — add new profiles/mappings there, not inline
- All providers must handle both streaming and non-streaming requests
- Implement proper credential management through Enconvo's credential system
- Test providers with both text and multimodal inputs where supported