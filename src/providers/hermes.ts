import { ChatOpenAIProvider } from "./open_ai.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:8642/v1";

function normalizeBaseUrl(baseUrl: string): string {
  let normalized = baseUrl.trim().replace(/\/+$/, "");
  normalized = normalized.replace(/\/v1\/chat\/completions$/i, "/v1");
  normalized = normalized.replace(/\/chat\/completions$/i, "");

  if (!/\/v1$/i.test(normalized)) {
    normalized = `${normalized}/v1`;
  }

  return normalized;
}

export default function main(options: any) {
  options.credentials = options.credentials || {};
  options.credentials.baseUrl = normalizeBaseUrl(
    options.credentials.baseUrl || DEFAULT_BASE_URL,
  );
  options.modelName = {
    ...options.modelName,
    autoContextCompact: false,
  };

  return new ChatOpenAIProvider(options);
}
