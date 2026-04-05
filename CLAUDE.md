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

### Streaming Implementation
- Each provider implements custom streaming logic
- Uses `Stream<BaseChatMessageChunk>` from Enconvo API
- Supports abort controllers for cancellation

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
- **LangChain-Based**: Cohere, Cloudflare Workers AI  
- **Direct SDK**: Anthropic, Google Gemini, X.AI
- **Custom Implementation**: Enconvo Cloud, Ollama, DeepSeek, others

## Development Guidelines

- Use `pnpm install` for package management (not npm)
- Follow existing naming conventions: `src/providers/chat_[provider].ts` for providers
- Model files follow pattern: `src/api/models/[provider].ts`
- Use `model_registry.ts` for model data enrichment — never hardcode pricing, context windows, or capabilities
- Use `reasoning_effort_data.ts` for reasoning preferences — add new profiles/mappings there, not inline
- All providers must handle both streaming and non-streaming requests
- Implement proper credential management through Enconvo's credential system
- Test providers with both text and multimodal inputs where supported