// Claude Models Data - Configuration for all available Claude models
// This file contains pricing, capabilities, and specifications for each model
// All Claude models support tool-use and vision capabilities

export const claude_models_data = [
  // Claude 3.5 Series
  {
    title: "Claude 3.5 Sonnet",
    value: "claude-3-5-sonnet-20241022",
    context: 200000,
    maxTokens: 8192,
    inputPrice: 3.0, // Standard pricing per 1M tokens
    outputPrice: 15.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 4,
  },
  {
    title: "Claude 3.5 Sonnet (Previous)",
    value: "claude-3-5-sonnet-20240620",
    context: 200000,
    maxTokens: 8192,
    inputPrice: 3.0, // Standard pricing per 1M tokens
    outputPrice: 15.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 4,
  },
  {
    title: "Claude 3.5 Haiku",
    value: "claude-3-5-haiku-20241022",
    context: 200000,
    maxTokens: 8192,
    inputPrice: 0.8, // Standard pricing per 1M tokens
    outputPrice: 4.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 3,
  },

  // Claude 3 Opus
  {
    title: "Claude 3 Opus",
    value: "claude-3-opus-20240229",
    context: 200000,
    maxTokens: 4096,
    inputPrice: 15.0, // Standard pricing per 1M tokens
    outputPrice: 75.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 5,
  },

  // Claude 3 Sonnet
  {
    title: "Claude 3 Sonnet",
    value: "claude-3-sonnet-20240229",
    context: 200000,
    maxTokens: 4096,
    inputPrice: 3.0, // Standard pricing per 1M tokens
    outputPrice: 15.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 4,
    intelligence: 4,
  },

  // Claude 3 Haiku
  {
    title: "Claude 3 Haiku",
    value: "claude-3-haiku-20240307",
    context: 200000,
    maxTokens: 4096,
    inputPrice: 0.25, // Standard pricing per 1M tokens
    outputPrice: 1.25,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 3,
  },

  // Claude 2 Series (Legacy)
  {
    title: "Claude 2.1",
    value: "claude-2.1",
    context: 200000,
    maxTokens: 4096,
    inputPrice: 8.0, // Standard pricing per 1M tokens
    outputPrice: 24.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 3,
  },
  {
    title: "Claude 2.0",
    value: "claude-2.0",
    context: 100000,
    maxTokens: 4096,
    inputPrice: 8.0, // Standard pricing per 1M tokens
    outputPrice: 24.0,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 3,
    intelligence: 3,
  },

  // Claude Instant Series (Legacy)
  {
    title: "Claude Instant 1.2",
    value: "claude-instant-1.2",
    context: 100000,
    maxTokens: 4096,
    inputPrice: 0.8, // Standard pricing per 1M tokens
    outputPrice: 2.4,
    toolUse: true,
    visionEnable: true,
    systemMessageEnable: true,
    speed: 5,
    intelligence: 2,
  },
];

// Export model value list for quick lookups
export const claude_model_values = claude_models_data.map(
  (model) => model.value,
);

// Helper function to get model data by value
export function getClaudeModelData(modelValue: string) {
  return claude_models_data.find((model) => model.value === modelValue);
}

// Helper function to check if a model supports vision
export function isClaudeVisionModel(modelValue: string): boolean {
  const model = getClaudeModelData(modelValue);
  return model?.visionEnable ?? false;
}

// Helper function to check if a model supports tools
export function isClaudeToolModel(modelValue: string): boolean {
  const model = getClaudeModelData(modelValue);
  return model?.toolUse ?? false;
}
