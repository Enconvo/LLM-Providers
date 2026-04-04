import { AnthropicProvider } from "./chat_anthropic.ts";

export default function main(options: any) {
  return new AnthropicProvider(options);
}
