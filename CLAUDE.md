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
- `npm run lint` - Run ESLint on src directory
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without changes

## Architecture

### Core Structure
- **Provider Pattern**: Each AI service is implemented as a separate provider class extending `LLMProvider` from `@enconvo/api`
- **Chat Interface**: All providers implement `_call()` and `_stream()` methods for sync and async chat completions
- **Model Management**: Dynamic model fetching and caching system for each provider
- **Utility Layer**: Shared utilities for message conversion, token counting, and provider-specific transformations

### Key Directories
- `src/` - Main source code
  - `chat_*.ts` - Individual provider implementations (e.g., `chat_anthropic.ts`, `chat_open_ai.ts`)
  - `*_models.ts` - Model list fetchers for each provider
  - `utils/` - Shared utilities for providers
    - `anthropic_util.ts` - Anthropic-specific utilities
    - `openai_util.ts` - OpenAI-specific utilities
    - `langchain_util.ts` - LangChain integration utilities
    - `openai_models_data.ts` - Static model data
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

### Model Fetching
- Most providers use dynamic model fetching via `fetch_models.ts`
- Some use static model lists (e.g., MoonShot, Yi)
- Models are cached using `DropdownListCache` from Enconvo API

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