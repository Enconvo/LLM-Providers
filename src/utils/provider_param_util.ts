export function getOutputTokenLimit(modelParams?: Record<string, unknown>): number | undefined {
  if (!modelParams) return undefined;
  return firstPositiveInteger(
    modelParams.maxOutputTokens,
    modelParams.max_output_tokens,
    modelParams.maxTokens,
    modelParams.max_tokens,
    modelParams.max_completion_tokens,
  );
}

function firstPositiveInteger(...values: unknown[]): number | undefined {
  for (const value of values) {
    const numericValue = typeof value === "string" ? Number(value) : value;
    if (
      typeof numericValue === "number" &&
      Number.isFinite(numericValue) &&
      numericValue > 0
    ) {
      return Math.floor(numericValue);
    }
  }
  return undefined;
}
