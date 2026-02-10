// OpenAI Models Data - Configuration for all available OpenAI models

import { Preference } from "@enconvo/api";


export const openai_codex_models_data: Preference.LLMModel[] = [
  {
    type: "llm_model",
    title: "GPT-5.3-codex",
    value: "gpt-5.3-codex",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25,
    outputPrice: 10,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,
    toolUse: true,
    visionEnable: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "none",
        data: [
          {
            title: "None",
            description: "No reasoning",
            value: "none"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
          {
            title: "X-High",
            description: "Extra high reasoning",
            value: "xhigh"
          }
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5.2",
    value: "gpt-5.2",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25,
    outputPrice: 10,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,

    toolUse: true,
    visionEnable: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "none",
        data: [
          {
            title: "None",
            description: "No reasoning",
            value: "none"
          },
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
          {
            title: "X-High",
            description: "Extra high reasoning",
            value: "xhigh"
          }
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5.2-codex",
    value: "gpt-5.2-codex",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25,
    outputPrice: 10,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,

    toolUse: true,
    visionEnable: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "none",
        data: [
          {
            title: "None",
            description: "No reasoning",
            value: "none"
          },
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
          {
            title: "X-High",
            description: "Extra high reasoning",
            value: "xhigh"
          }
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5.1",
    value: "gpt-5.1",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25,
    outputPrice: 10,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,

    toolUse: true,
    visionEnable: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "none",
        data: [
          {
            title: "None",
            description: "No reasoning",
            value: "none"
          },
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
          {
            title: "X-High",
            description: "Extra high reasoning",
            value: "xhigh"
          }
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5.1-codex",
    value: "gpt-5.1-codex",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25,
    outputPrice: 10,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,

    toolUse: true,
    visionEnable: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "none",
        data: [
          {
            title: "None",
            description: "No reasoning",
            value: "none"
          },
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
          {
            title: "X-High",
            description: "Extra high reasoning",
            value: "xhigh"
          }
        ]
      }
    ]
  }
];

export const openai_models_data: Preference.LLMModel[] = [
  // GPT-5 Series - Frontier models
  {
    type: "llm_model",
    title: "GPT-5",
    value: "gpt-5",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,

    toolUse: true,
    visionEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "minimal",
        data: [
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5-mini",
    value: "gpt-5-mini",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 0.25, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    systemMessageEnable: true,
    speed: 4,
    reasoning: 3,

    toolUse: true,
    visionEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "minimal",
        data: [
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5-nano",
    value: "gpt-5-nano",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 0.05, // Standard pricing per 1M tokens
    outputPrice: 0.4,
    systemMessageEnable: true,
    speed: 5,
    reasoning: 3,

    toolUse: true,
    visionEnable: true,
    searchToolSupported: true,
    preferences: [
      {
        name: "reasoning_effort",
        description: "Applicable to reasoning models only, this option controls the reasoning token length.",
        type: "dropdown",
        required: false,
        title: "Reasoning Effort",
        default: "minimal",
        data: [
          {
            title: "Minimal",
            description: "Minimal reasoning",
            value: "minimal"
          },
          {
            title: "Low",
            description: "Basic reasoning",
            value: "low"
          },
          {
            title: "Medium",
            description: "Medium reasoning",
            value: "medium"
          },
          {
            title: "High",
            description: "High reasoning",
            value: "high"
          },
        ]
      }
    ]
  },
  {
    type: "llm_model",
    title: "GPT-5-chat-latest",
    value: "gpt-5-chat-latest",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    reasoning: 4,
    imageGeneration: false,
  },
  {
    type: "llm_model",
    title: "GPT-5-2025-08-07",
    value: "gpt-5-2025-08-07",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 1.25, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    speed: 3,
  },
  {
    type: "llm_model",
    title: "GPT-5-mini-2025-08-07",
    value: "gpt-5-mini-2025-08-07",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 0.25, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    speed: 4,
    reasoning: 3,
  },
  {
    type: "llm_model",
    title: "GPT-5-nano-2025-08-07",
    value: "gpt-5-nano-2025-08-07",
    context: 400000,
    maxTokens: 128000,
    inputPrice: 0.05, // Standard pricing per 1M tokens
    outputPrice: 0.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    speed: 5,
    reasoning: 3,
  },

  // GPT-4.1 Series
  {
    type: "llm_model",
    title: "GPT-4.1",
    value: "gpt-4.1",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 8.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    searchToolSupported: true,
    imageGeneration: true,
    speed: 3,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4.1-mini",
    value: "gpt-4.1-mini",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 0.4, // Standard pricing per 1M tokens
    outputPrice: 1.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
    searchToolSupported: true,
    imageGeneration: true,
  },
  {
    type: "llm_model",
    title: "GPT-4.1-nano",
    value: "gpt-4.1-nano",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 0.1, // Standard pricing per 1M tokens
    outputPrice: 0.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
    searchToolSupported: true,
    imageGeneration: true,
  },
  {
    type: "llm_model",
    title: "GPT-4.1-2025-04-14",
    value: "gpt-4.1-2025-04-14",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 8.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 4,
    searchToolSupported: true,
    imageGeneration: true,
  },
  {
    type: "llm_model",
    title: "GPT-4.1-mini-2025-04-14",
    value: "gpt-4.1-mini-2025-04-14",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 0.4, // Standard pricing per 1M tokens
    outputPrice: 1.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
    searchToolSupported: true,
    imageGeneration: true,
  },
  {
    type: "llm_model",
    title: "GPT-4.1-nano-2025-04-14",
    value: "gpt-4.1-nano-2025-04-14",
    context: 1047576,
    maxTokens: 32768,
    inputPrice: 0.1, // Standard pricing per 1M tokens
    outputPrice: 0.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
    searchToolSupported: true,
    imageGeneration: true,
  },

  {
    type: "llm_model",
    title: "o3",
    value: "o3",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 8.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-pro",
    value: "o3-pro",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 20.0, // Standard pricing per 1M tokens
    outputPrice: 80.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-mini",
    value: "o3-mini",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-2025-04-16",
    value: "o3-2025-04-16",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 8.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-mini-2025-01-31",
    value: "o3-mini-2025-01-31",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-pro-2025-06-10",
    value: "o3-pro-2025-06-10",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 20.0, // Standard pricing per 1M tokens
    outputPrice: 80.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o3-deep-research",
    value: "o3-deep-research",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 40.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },

  // o4-mini Series
  {
    type: "llm_model",
    title: "o4-mini",
    value: "o4-mini",
    context: 200000,
    maxTokens: 65536,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o4-mini-2025-04-16",
    value: "o4-mini-2025-04-16",
    context: 200000,
    maxTokens: 65536,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o4-mini-deep-research",
    value: "o4-mini-deep-research",
    context: 200000,
    maxTokens: 65536,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 8.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },

  // o1 Series (Previous Generation Reasoning)
  {
    type: "llm_model",
    title: "o1",
    value: "o1",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 15.0, // Standard pricing per 1M tokens
    outputPrice: 60.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o1-pro",
    value: "o1-pro",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 150.0, // Standard pricing per 1M tokens
    outputPrice: 600.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o1-mini",
    value: "o1-mini",
    context: 128000,
    maxTokens: 65536,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o1-2024-12-17",
    value: "o1-2024-12-17",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 15.0, // Standard pricing per 1M tokens
    outputPrice: 60.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o1-pro-2025-03-19",
    value: "o1-pro-2025-03-19",
    context: 200000,
    maxTokens: 100000,
    inputPrice: 150.0, // Standard pricing per 1M tokens
    outputPrice: 600.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 1,
    reasoning: 5,
  },
  {
    type: "llm_model",
    title: "o1-mini-2024-09-12",
    value: "o1-mini-2024-09-12",
    context: 128000,
    maxTokens: 65536,
    inputPrice: 1.1, // Standard pricing per 1M tokens
    outputPrice: 4.4,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 2,
    reasoning: 5,
  },

  // GPT-4o Series
  {
    type: "llm_model",
    title: "GPT-4o",
    value: "gpt-4o",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini",
    value: "gpt-4o-mini",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.15, // Standard pricing per 1M tokens
    outputPrice: 0.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-4o-2024-05-13",
    value: "gpt-4o-2024-05-13",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 5.0, // Standard pricing per 1M tokens
    outputPrice: 15.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-2024-08-06",
    value: "gpt-4o-2024-08-06",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-2024-11-20",
    value: "gpt-4o-2024-11-20",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini-2024-07-18",
    value: "gpt-4o-mini-2024-07-18",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.15, // Standard pricing per 1M tokens
    outputPrice: 0.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "chatgpt-4o-latest",
    value: "chatgpt-4o-latest",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 5.0, // Standard pricing per 1M tokens
    outputPrice: 15.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 3,
  },

  // GPT-4o Audio and Realtime Models
  {
    type: "llm_model",
    title: "GPT-4o-audio-preview",
    value: "gpt-4o-audio-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini-audio-preview",
    value: "gpt-4o-mini-audio-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.15, // Standard pricing per 1M tokens
    outputPrice: 0.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-4o-realtime-preview",
    value: "gpt-4o-realtime-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 5.0, // Standard pricing per 1M tokens
    outputPrice: 20.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini-realtime-preview",
    value: "gpt-4o-mini-realtime-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.6, // Standard pricing per 1M tokens
    outputPrice: 2.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },

  // Search Models
  {
    type: "llm_model",
    title: "GPT-4o-search-preview",
    value: "gpt-4o-search-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 3,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini-search-preview",
    value: "gpt-4o-mini-search-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.15, // Standard pricing per 1M tokens
    outputPrice: 0.6,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 2,
  },

  // Specialized Models
  {
    type: "llm_model",
    title: "computer-use-preview",
    value: "computer-use-preview",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 3.0, // Standard pricing per 1M tokens
    outputPrice: 12.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "codex-mini-latest",
    value: "codex-mini-latest",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 1.5, // Standard pricing per 1M tokens
    outputPrice: 6.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 4,
    reasoning: 2,
  },

  // Transcription Models
  {
    type: "llm_model",
    title: "GPT-4o-transcribe",
    value: "gpt-4o-transcribe",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 2.5, // Standard pricing per 1M tokens
    outputPrice: 10.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4o-mini-transcribe",
    value: "gpt-4o-mini-transcribe",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 1.25, // Standard pricing per 1M tokens
    outputPrice: 5.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
  },

  // TTS Models
  {
    type: "llm_model",
    title: "GPT-4o-mini-tts",
    value: "gpt-4o-mini-tts",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 0.6, // Standard pricing per 1M tokens for text input
    outputPrice: 12.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 4,
  },

  // Legacy GPT-4 Models
  {
    type: "llm_model",
    title: "GPT-4-turbo",
    value: "gpt-4-turbo",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 30.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-turbo-2024-04-09",
    value: "gpt-4-turbo-2024-04-09",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 30.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-turbo-preview",
    value: "gpt-4-turbo-preview",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 30.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4",
    value: "gpt-4",
    context: 8192,
    maxTokens: 8192,
    inputPrice: 30.0, // Standard pricing per 1M tokens
    outputPrice: 60.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-0613",
    value: "gpt-4-0613",
    context: 8192,
    maxTokens: 8192,
    inputPrice: 30.0, // Standard pricing per 1M tokens
    outputPrice: 60.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-32k",
    value: "gpt-4-32k",
    context: 32768,
    maxTokens: 8192,
    inputPrice: 60.0, // Standard pricing per 1M tokens
    outputPrice: 120.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 1,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-1106-preview",
    value: "gpt-4-1106-preview",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 30.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },
  {
    type: "llm_model",
    title: "GPT-4-vision-preview",
    value: "gpt-4-vision-preview",
    context: 128000,
    maxTokens: 4096,
    inputPrice: 10.0, // Standard pricing per 1M tokens
    outputPrice: 30.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 2,
    intelligence: 4,
  },

  // GPT-3.5 Series
  {
    type: "llm_model",
    title: "GPT-3.5-turbo",
    value: "gpt-3.5-turbo",
    context: 16385,
    maxTokens: 4096,
    inputPrice: 0.5, // Standard pricing per 1M tokens
    outputPrice: 1.5,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-3.5-turbo-0125",
    value: "gpt-3.5-turbo-0125",
    context: 16385,
    maxTokens: 4096,
    inputPrice: 0.5, // Standard pricing per 1M tokens
    outputPrice: 1.5,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-3.5-turbo-1106",
    value: "gpt-3.5-turbo-1106",
    context: 16385,
    maxTokens: 4096,
    inputPrice: 1.0, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-3.5-turbo-0613",
    value: "gpt-3.5-turbo-0613",
    context: 4096,
    maxTokens: 4096,
    inputPrice: 1.5, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    toolUse: true,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
  {
    type: "llm_model",
    title: "GPT-3.5-turbo-instruct",
    value: "gpt-3.5-turbo-instruct",
    context: 4096,
    maxTokens: 4096,
    inputPrice: 1.5, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },

  // Image Generation Models
  {
    type: "llm_model",
    title: "GPT-image-1",
    value: "gpt-image-1",
    context: 128000,
    maxTokens: 16384,
    inputPrice: 5.0, // Standard pricing per 1M tokens
    outputPrice: 40.0, // Output pricing for image generation
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
  },
  {
    type: "llm_model",
    title: "dall-e-3",
    value: "dall-e-3",
    context: 4000,
    maxTokens: 4000,
    inputPrice: 40.0, // Image generation pricing is different - this is per image
    outputPrice: 40.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 2,
  },
  {
    type: "llm_model",
    title: "dall-e-2",
    value: "dall-e-2",
    context: 1000,
    maxTokens: 1000,
    inputPrice: 16.0, // Image generation pricing is different - this is per image
    outputPrice: 16.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 3,
  },

  // Audio Models
  {
    type: "llm_model",
    title: "whisper-1",
    value: "whisper-1",
    context: 25000,
    maxTokens: 25000,
    inputPrice: 6.0, // Transcription pricing - $0.006 per minute
    outputPrice: 6.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 4,
  },
  {
    type: "llm_model",
    title: "tts-1",
    value: "tts-1",
    context: 4096,
    maxTokens: 4096,
    inputPrice: 15.0, // TTS pricing - $15.00 per 1M characters
    outputPrice: 15.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 4,
  },
  {
    type: "llm_model",
    title: "tts-1-hd",
    value: "tts-1-hd",
    context: 4096,
    maxTokens: 4096,
    inputPrice: 30.0, // TTS HD pricing - $30.00 per 1M characters
    outputPrice: 30.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 3,
  },

  // Embedding Models
  {
    type: "llm_model",
    title: "text-embedding-3-large",
    value: "text-embedding-3-large",
    context: 8191,
    maxTokens: 8191,
    inputPrice: 0.065, // Standard pricing per 1M tokens
    outputPrice: 0.065,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 5,
  },
  {
    type: "llm_model",
    title: "text-embedding-3-small",
    value: "text-embedding-3-small",
    context: 8191,
    maxTokens: 8191,
    inputPrice: 0.01, // Standard pricing per 1M tokens
    outputPrice: 0.01,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 5,
  },
  {
    type: "llm_model",
    title: "text-embedding-ada-002",
    value: "text-embedding-ada-002",
    context: 8191,
    maxTokens: 8191,
    inputPrice: 0.05, // Standard pricing per 1M tokens
    outputPrice: 0.05,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: false,
    speed: 4,
  },

  // Base Models
  {
    type: "llm_model",
    title: "davinci-002",
    value: "davinci-002",
    context: 16384,
    maxTokens: 16384,
    inputPrice: 2.0, // Standard pricing per 1M tokens
    outputPrice: 2.0,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 3,
  },
  {
    type: "llm_model",
    title: "babbage-002",
    value: "babbage-002",
    context: 16384,
    maxTokens: 16384,
    inputPrice: 0.4, // Standard pricing per 1M tokens
    outputPrice: 0.4,
    toolUse: false,
    visionEnable: false,
    systemMessageEnable: true,
    speed: 5,
  },

  // Moderation Models
  {
    type: "llm_model",
    title: "omni-moderation-latest",
    value: "omni-moderation-latest",
    context: 32768,
    maxTokens: 32768,
    inputPrice: 0.0, // Free moderation models
    outputPrice: 0.0,
    toolUse: false,
    visionEnable: true,
    systemMessageEnable: false,
    speed: 5,
  },
];
