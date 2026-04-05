---
name: llm
description: >
  LLM provider integrations for 20+ services including OpenAI, Anthropic, Google, Ollama, Groq, Mistral, and more, with unified streaming chat completion and model management APIs.
  All model data (pricing, context windows, capabilities) is sourced from a centralized registry backed by litellm's 2600+ model database with automatic updates.
  Reasoning effort preferences are managed centrally per model/provider profile.
metadata:
  author: ysnows
  version: "1.3.341"
---

## Architecture

### Model Data Flow
1. **Model Registry** (`utils/model_registry.ts`) — fetches litellm's `model_prices_and_context_window.json` from GitHub, caches locally with stale-while-revalidate (24h stale / 7d expire / ETag conditional requests). Provides `getModel(id)` for O(1) lookups of pricing, context, and capabilities (vision, tool use, audio, video, reasoning, etc.).
2. **Reasoning Effort** (`utils/reasoning_effort_data.ts`) — centralized profiles for reasoning effort preferences. Different providers use different formats (OpenAI: low/medium/high, Anthropic: token budgets, Gemini 2.5: auto/budget tokens, Ollama: enabled/disabled). `getReasoningEffortPreference(modelId, provider?)` returns the correct dropdown config.
3. **Model Fetchers** (`api/models/*.ts`) — each provider fetches its model list from the API (or uses static data), then enriches with registry data and reasoning effort preferences.

## API Reference

Just use the `local_api` tool to request these APIs.

| Endpoint | Description |
|----------|-------------|
| `llm/enconvo_ai` | Chat using EnconvoAI which provide LLM service, , learn more : [docs](https://www.enconvo.com/cloud-plan). _No params_ |
| `llm/test` | _No params_ |
| `llm/models/1minai` | Fetch and search 1min AI model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/aimagicx` | Fetch and search Aimagicx model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/anthropic` | Fetch and search Anthropic model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/azure` | Fetch and search Azure OpenAI model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/cerebras` | Fetch and search Cerebras model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/dashscope` | Fetch and search DashScope model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/deepseek` | Fetch and search DeepSeek model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/enconvo_ai` | Main handler function for the API endpoint. _No params_ |
| `llm/models/fetch` | Fetch and search model list from a generic OpenAI-compatible endpoint. _5 params — use `check_local_api_schemas` tool_ |
| `llm/models/fireworks` | Fetch and search Fireworks model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/gemini` | Fetch and search Gemini model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/groq` | Fetch and search Groq model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/mistral` | Fetch and search Mistral model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/moonshot` | Fetch and search Moonshot model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/ollama` | Fetch and search Ollama model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/openai` | Fetch and search OpenAI-compatible model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/openrouter` | Fetch and search OpenRouter model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/poe` | Fetch and search Poe model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/qwen` | Fetch and search Qwen model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/sambanova` | Fetch and search SambaNova model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/straico` | Fetch and search Straico model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/vercel_ai_gateway` | Fetch and search Vercel AI Gateway model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |
| `llm/models/x_ai` | Fetch and search xAI model list. Params: `forceRefresh` (boolean, default: false), `query` (string) |

