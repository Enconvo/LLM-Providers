import {
  AssistantMessage,
  BaseChatMessage,
  BaseChatMessageChunk,
  ChatMessageContent,
  ChatMessageContentToolUse,
  LLMProvider,
  NativeAPI,
  Stream,
} from "@enconvo/api";
import OpenAI from "openai";
import { OpenAIUtil } from "../utils/openai_util.ts";

const MLX_LOCAL_BASE_URL =
  process.env.localServerBaseUrl || "http://localhost:54535";

const VISION_NAME_PATTERNS = [
  /\bvl\b/i,
  /vision/i,
  /llava/i,
  /minicpm-?v/i,
  /qwen2-?vl/i,
  /qwen3-?vl/i,
  /internvl/i,
  /janus/i,
  /florence/i,
  /idefics/i,
  /molmo/i,
  /phi-?3-?vision/i,
  /gemma-?4/i,
  /pixtral/i,
  /deepseek-?vl/i,
  /smolvlm/i,
];

const AUDIO_NAME_PATTERNS = [
  /audio/i,
  /gemma-?4/i,
  /phi-?4-?mm/i,
  /phi-?4-?multimodal/i,
  /qwen2-?audio/i,
];

function guessVisionFromId(modelId: string): boolean {
  return VISION_NAME_PATTERNS.some((p) => p.test(modelId));
}

function guessAudioFromId(modelId: string): boolean {
  return AUDIO_NAME_PATTERNS.some((p) => p.test(modelId));
}

export default function main(options: any) {
  return new ChatMLXProvider(options);
}

export class ChatMLXProvider extends LLMProvider {
  private visionCache = new Map<string, boolean>();

  async preload(): Promise<void> {
    const opts = this.options as LLMProvider.LLMOptions & {
      modelName?: { value: string };
    };
    const modelId = opts.modelName?.value;
    if (!modelId) return;
    const isVision = await this.detectVision(modelId);
    await NativeAPI.localApi("mlx_manage/model/load", {
      model_id: modelId,
      category: isVision ? "vlm" : "llm",
    }).catch(() => undefined);
  }

  private async detectVision(modelId: string): Promise<boolean> {
    if (this.visionCache.has(modelId)) return this.visionCache.get(modelId)!;
    try {
      const resp = await NativeAPI.localApi("mlx_manage/model/info", {
        model_id: modelId,
      });
      const data = (await resp.json()) as {
        success?: boolean;
        info?: { visionEnable?: boolean };
      };
      if (data?.success && typeof data.info?.visionEnable === "boolean") {
        const v = data.info.visionEnable;
        this.visionCache.set(modelId, v);
        return v;
      }
    } catch {
      // fall through to id-based guess
    }
    const guess = guessVisionFromId(modelId);
    this.visionCache.set(modelId, guess);
    return guess;
  }

  protected async _stream(
    content: LLMProvider.ResolvedParams,
  ): Promise<Stream<BaseChatMessageChunk>> {
    const params = await this.initParams(content);
    const route = await this.routeFor(params.model);
    const client = this.createOpenAIClient(route);
    const chatCompletion = await client.chat.completions.create(
      {
        ...params,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      },
      {
        signal: content.signal as AbortSignal | undefined,
      },
    );

    const ac = new AbortController();
    return OpenAIUtil.streamFromOpenAI(
      chatCompletion as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
      ac,
      this.options,
    );
  }

  protected async _call(
    content: LLMProvider.ResolvedParams,
  ): Promise<BaseChatMessage> {
    const params = await this.initParams(content);
    const route = await this.routeFor(params.model);
    const client = this.createOpenAIClient(route);
    const chatCompletion = await client.chat.completions.create(params, {
      signal: content.signal as AbortSignal | undefined,
    });
    return this.messageFromOpenAI(chatCompletion.choices[0]?.message);
  }

  private messageFromOpenAI(
    message?: OpenAI.Chat.ChatCompletionMessage,
  ): BaseChatMessage {
    const messageContents: ChatMessageContent[] = [];
    const text = message?.content;

    if (typeof text === "string" && text) {
      messageContents.push({ type: "text", text });
    } else if (Array.isArray(text)) {
      for (const item of text as any[]) {
        if (item?.type === "text" && item.text) {
          messageContents.push({ type: "text", text: item.text });
        }
      }
    }

    const reasoning =
      (message as any)?.reasoning_content || (message as any)?.reasoning;
    if (typeof reasoning === "string" && reasoning) {
      messageContents.push(
        ChatMessageContent.thinking({
          content: reasoning,
          time: 0,
          status: "success",
        }),
      );
    }

    for (const toolCall of message?.tool_calls ?? []) {
      const fn = (toolCall as any).function;
      if (!fn?.name) continue;
      let input: unknown = {};
      try {
        input =
          typeof fn.arguments === "string"
            ? JSON.parse(fn.arguments || "{}")
            : fn.arguments || {};
      } catch {
        input = {};
      }
      messageContents.push(
        new ChatMessageContentToolUse(fn.name, input, toolCall.id),
      );
    }

    return new AssistantMessage({ content: messageContents });
  }

  private async routeFor(modelId: string): Promise<string> {
    const isVision = await this.detectVision(modelId);
    return isVision
      ? "mlx_manage/mlx_vlm/openai_chat_completions"
      : "mlx_manage/mlx_lm/openai_chat_completions";
  }

  private createOpenAIClient(route: string): OpenAI {
    const localFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const upstreamRequest =
        input instanceof Request ? input : new Request(input, init);
      const body =
        upstreamRequest.method === "GET" || upstreamRequest.method === "HEAD"
          ? undefined
          : await upstreamRequest.text();
      const headers = new Headers(upstreamRequest.headers);
      headers.set("Content-Type", "application/json");

      const response = await fetch(`${MLX_LOCAL_BASE_URL}/${route}`, {
        method: upstreamRequest.method,
        headers,
        body,
        signal:
          (init?.signal as AbortSignal | undefined) ?? upstreamRequest.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`MLX ${route} failed (${response.status}): ${text}`);
      }
      return response;
    };

    return new OpenAI({
      apiKey: "mlx-local",
      baseURL: "http://mlx.local/v1",
      maxRetries: 0,
      fetch: localFetch as any,
    });
  }

  protected async initParams(
    content: LLMProvider.ResolvedParams,
  ): Promise<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming> {
    const modelOptions = this.options.modelName;
    const model = modelOptions?.value;
    if (!model) {
      throw new Error("MLX modelName is required");
    }
    const isVision = await this.detectVision(model);
    const effectiveOptions = {
      ...this.options,
      modelName: {
        ...modelOptions,
        visionEnable: isVision || modelOptions?.visionEnable === true,
        audioEnable:
          modelOptions?.audioEnable === true ||
          (isVision && guessAudioFromId(model)),
      },
    } as LLMProvider.LLMOptions;

    const messages = await OpenAIUtil.convertMessagesToOpenAIMessages(
      effectiveOptions,
      content.messages,
      content,
    );

    let temperature = Number(this.options.temperature?.value);
    if (Number.isNaN(temperature)) temperature = 0.7;
    temperature = Math.max(0, Math.min(temperature, 1));

    const reasoningEffort =
      this.options?.reasoning_effort?.value ||
      this.options?.reasoning_effort_new?.value;
    const enableThinking =
      Boolean(reasoningEffort) && reasoningEffort !== "off";
    const maxTokens = Number(
      modelOptions?.maxTokens || modelOptions?.max_tokens || 8192,
    );

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
      chat_template_kwargs?: Record<string, unknown>;
    } = {
      model,
      temperature,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 8192,
      messages,
      chat_template_kwargs: { enable_thinking: enableThinking },
    };

    const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools);
    if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
      params.tools = tools;
      params.tool_choice = this.normalizeToolChoice(content.tool_choice);
      params.parallel_tool_calls = false;
    }

    return params;
  }

  private normalizeToolChoice(
    toolChoice: unknown,
  ): OpenAI.Chat.ChatCompletionToolChoiceOption {
    if (!toolChoice) return "auto";
    if (typeof toolChoice === "string") {
      return toolChoice as OpenAI.Chat.ChatCompletionToolChoiceOption;
    }

    const name =
      (toolChoice as any)?.function?.name || (toolChoice as any)?.name;
    if (!name) return "auto";

    return {
      type: "function",
      function: { name },
    };
  }
}
