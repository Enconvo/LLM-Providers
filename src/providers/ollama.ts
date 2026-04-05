import { AnthropicProvider } from "./anthropic.ts";

export default function main(options: any) {

  if (options.credentials && (!options.credentials?.apiKey || options.credentials?.apiKey?.length === 0)) {
    options.credentials.apiKey = 'ollama'
  }

  return new AnthropicProvider(options);
}

