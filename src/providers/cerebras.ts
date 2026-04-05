import { ChatOpenAIProvider } from "./open_ai.ts";

export default function main(options: any) {
  return new ChatOpenAIProvider(options);
}
