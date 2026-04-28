import { AnthropicProvider } from "./anthropic.ts";

export default function main(options: any) {
  return new AnthropicProvider(options);
}
