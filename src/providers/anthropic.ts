import {
  AssistantMessage,
  CredentialsProvider,
  BaseChatMessage,
  BaseChatMessageChunk,
  LLMProvider,
  Stream,
} from "@enconvo/api";
import Anthropic, { ClientOptions } from "@anthropic-ai/sdk";
import {
  AnthropicUtil,
  convertMessagesToAnthropicMessages,
  streamFromAnthropic,
  stripThinkingBlocksFromAnthropicMessages,
} from "../utils/anthropic_util.ts";
import { env } from "process";

import {
  MessageStreamParams,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/index.js";
import { additionalWithProviderUsage } from "../utils/usage_util.ts";
import { getOutputTokenLimit } from "../utils/provider_param_util.ts";
import {
  dispatchedFetch,
  isTerminatedSocketError,
} from "../utils/http_client.ts";

export default function main(options: any) {
  return new AnthropicProvider(options);
}

export class AnthropicProvider extends LLMProvider {
  anthropic: Anthropic;

  constructor(options: LLMProvider.LLMOptions) {
    super(options);
  }

  async initClient() {
    // if (this.anthropic) {
    //   return;
    // }

    const options = this.options;
    let headers: Record<string, string> = {};

    if (options.originCommandName === "enconvo_ai") {
      headers = {
        accessToken: `${env["accessToken"]}`,
        client_id: `${env["client_id"]}`,
        commandKey: `${env["commandKey"]}`,
        commandTitle: `${env["commandTitle"]}`,
        modelName: options.modelName.value,
      };
    }

    const credentials = options.credentials;
    const credentialsType = credentials?.credentials_type?.value || "apiKey";

    let oauthCredentials: CredentialsProvider.Credentials | null = null;
    if (credentialsType === "oauth2") {
      const authProvider = await CredentialsProvider.create("anthropic");
      oauthCredentials = await authProvider.load();
      // console.log("loaded anthropic credentials", oauthCredentials, authProvider);

      headers["anthropic-beta"] =
        "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";
    } else {
      headers["anthropic-beta"] =
        "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";
    }

    const params: ClientOptions = {
      apiKey:
        credentialsType === "apiKey"
          ? credentials?.anthropicApiKey || credentials?.apiKey
          : undefined,
      authToken:
        credentialsType === "oauth2"
          ? oauthCredentials?.access_token
          : undefined,
      baseURL: credentials?.anthropicApiUrl || credentials?.baseUrl,
      defaultHeaders: headers,
      fetch: dispatchedFetch,
    };
    const anthropic = new Anthropic(params);

    this.anthropic = anthropic;
  }

  protected async _call(
    content: LLMProvider.ResolvedParams,
  ): Promise<BaseChatMessage> {
    await this.initClient();
    const stream = await this._stream(content);
    let message = "";
    let usage: any;
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta?.type === "text_delta"
      ) {
        message += chunk.delta.text;
      } else if (chunk.type === "usage") {
        usage = chunk.usage;
      }
    }

    return new AssistantMessage({
      content: message,
      additional: additionalWithProviderUsage(undefined, usage),
    });
  }

  protected async _stream(
    content: LLMProvider.ResolvedParams,
  ): Promise<Stream<BaseChatMessageChunk>> {
    await this.initClient();
    const credentials = this.options.credentials;
    if (
      !credentials?.anthropicApiKey &&
      !credentials?.apiKey &&
      !credentials?.access_token
    ) {
      console.error("Anthropic credentials are missing", credentials);
      throw new Error("Anthropic API key or OAuth is required");
    }

    const params = await this.initParams(content);
    // console.log("Final Anthropic API params", JSON.stringify(params, null, 2));

    const userSignal: AbortSignal | undefined = content.signal;
    const downstream = new AbortController();
    if (userSignal) {
      if (userSignal.aborted) {
        downstream.abort();
      } else {
        userSignal.addEventListener("abort", () => downstream.abort(), {
          once: true,
        });
      }
    }

    let activeAttemptController: AbortController | null = null;
    downstream.signal.addEventListener(
      "abort",
      () => activeAttemptController?.abort(),
      { once: true },
    );

    const anthropic = this.anthropic;
    const maxRetries = 2;

    async function* withTerminatedRetry(): AsyncIterable<Anthropic.Messages.MessageStreamEvent> {
      let activeParams = params;
      let retriedWithoutThinking = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let yieldedAny = false;
        const stream = anthropic.messages.stream(activeParams, {
          signal: userSignal,
        });
        activeAttemptController = stream.controller;
        try {
          for await (const chunk of stream) {
            yieldedAny = true;
            yield chunk;
          }
          return;
        } catch (err) {
          const aborted =
            userSignal?.aborted === true || downstream.signal.aborted;
          if (
            !aborted &&
            !yieldedAny &&
            !retriedWithoutThinking &&
            isInvalidThinkingSignatureError(err)
          ) {
            const stripped = stripThinkingBlocksFromAnthropicMessages(
              activeParams.messages,
            );
            if (stripped.removed > 0) {
              retriedWithoutThinking = true;
              activeParams = {
                ...activeParams,
                messages: stripped.messages,
              };
              console.warn(
                `anthropic invalid thinking signature; retrying without ${stripped.removed} thinking block(s)`,
              );
              continue;
            }
          }
          if (
            aborted ||
            yieldedAny ||
            attempt >= maxRetries ||
            !isTerminatedSocketError(err)
          ) {
            throw err;
          }
          const backoffMs = 250 * (attempt + 1);
          console.warn(
            `anthropic stream terminated before any chunk (attempt ${attempt + 1}/${maxRetries + 1}); retrying in ${backoffMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    return streamFromAnthropic(withTerminatedRetry(), downstream);
  }

  async initParams(
    content: LLMProvider.ResolvedParams,
  ): Promise<MessageStreamParams> {
    const messages = content.messages;
    // console.log('anthropic messages', JSON.stringify(messages, null, 2))
    const systemMessages = messages.filter(
      (message) => message.role === "system",
    );
    const system: Array<TextBlockParam> = [];

    const credentialsType =
      this.options.credentials?.credentials_type?.value || "apiKey";
    if (credentialsType === "oauth2") {
      system.push({
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
      });
    }

    for (const message of systemMessages) {
      if (typeof message.content === "string") {
        system.push({
          type: "text",
          text: message.content,
        });
      } else {
        for (const content of message.content) {
          if (content.type === "text") {
            system.push({
              type: "text",
              text: content.text,
            });
          }
        }
      }
    }

    const conversationMessages = messages.filter(
      (message) => message.role !== "system",
    );

    const newMessages = await convertMessagesToAnthropicMessages(
      conversationMessages,
      this.options,
      content,
    );

    const model = this.options.modelName.value;
    let temperature = Number(this.options.temperature.value);
    if (temperature > 1) {
      temperature = 1;
    }
    if (temperature < 0) {
      temperature = 0;
    }

    const defaultMaxTokens =
      getOutputTokenLimit(content.modelParams) ||
      this.options.modelName.maxTokens ||
      8192;

    let params: MessageStreamParams = {
      system,
      model: model,
      temperature: temperature,
      max_tokens: defaultMaxTokens,
      messages: newMessages,
    };

    const modelNameConfig: { reasoning_effort: string } =
      this.options?.modelName_preferences?.[params.model || ""];
    let reasoning_effort = modelNameConfig?.reasoning_effort;
    if (reasoning_effort) {
      if (reasoning_effort === "disabled" || reasoning_effort === "none") {
        params.thinking = {
          type: "disabled",
        };
      } else {
        const budgetTokens = parseInt(reasoning_effort);
        if (
          !Number.isNaN(budgetTokens) &&
          String(budgetTokens) === reasoning_effort
        ) {
          params.thinking = {
            type: "enabled",
            budget_tokens: budgetTokens,
          };
        } else {
          params.thinking = {
            type: "adaptive",
          };
          params.output_config = {
            ...(params.output_config ?? {}),
            effort: reasoning_effort as
              | "low"
              | "medium"
              | "high"
              | "xhigh"
              | "max",
          };
        }
      }
    }

    let tools: Anthropic.ToolUnion[] = [];
    const newTools = AnthropicUtil.convertToolsToAnthropicTools(content.tools);
    if (newTools) {
      tools.push(...newTools);
    }

    if (tools.length > 0) {
      params.tools = tools;
      if (content.tool_choice && typeof content.tool_choice !== "string") {
        params.tool_choice = {
          type: "tool",
          name: content.tool_choice.function.name,
          disable_parallel_tool_use: true,
        };
      } else {
        params.tool_choice = {
          type: "auto",
          disable_parallel_tool_use: true,
        };
      }
    }

    // console.log("anthropic params", JSON.stringify(params, null, 2));

    return params;
  }
}

function isInvalidThinkingSignatureError(error: unknown): boolean {
  const err = error as {
    status?: number;
    message?: string;
    error?: {
      message?: string;
      error?: {
        message?: string;
      };
    };
  };
  const message = [
    err?.message,
    err?.error?.message,
    err?.error?.error?.message,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");

  return (
    err?.status === 400 &&
    /Invalid `?signature`? in `?thinking`? block/i.test(message)
  );
}
