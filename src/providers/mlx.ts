import Anthropic, { ClientOptions } from "@anthropic-ai/sdk";
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
import {
  MessageStreamParams,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/index.js";
import { AnthropicUtil, streamFromAnthropic } from "../utils/anthropic_util.ts";
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
    const anthropic = this.createAnthropicClient(route);
    const stream = anthropic.messages.stream(params, {
      signal: content.signal as AbortSignal | undefined,
    });
    return streamFromAnthropic(stream, stream.controller);
  }

  protected async _call(
    content: LLMProvider.ResolvedParams,
  ): Promise<BaseChatMessage> {
    const params = await this.initParams(content);
    const route = await this.routeFor(params.model);
    const anthropic = this.createAnthropicClient(route);
    const message = await anthropic.messages.create(params as any, {
      signal: content.signal as AbortSignal | undefined,
    });
    return this.messageFromAnthropic(message);
  }

  private messageFromAnthropic(message: Anthropic.Message): BaseChatMessage {
    const messageContents: ChatMessageContent[] = [];

    for (const block of message.content ?? []) {
      if (block.type === "text" && block.text) {
        messageContents.push({ type: "text", text: block.text });
      } else if (block.type === "thinking" && block.thinking) {
        messageContents.push(
          ChatMessageContent.thinking({
            content: block.thinking,
            time: 0,
            status: "success",
          }),
        );
      } else if (block.type === "tool_use") {
        messageContents.push(
          new ChatMessageContentToolUse(
            block.name,
            block.input ?? {},
            block.id,
          ),
        );
      }
    }

    return new AssistantMessage({ content: messageContents });
  }

  private async routeFor(modelId: string): Promise<string> {
    const isVision = await this.detectVision(modelId);
    return isVision
      ? "mlx_manage/mlx_vlm/anthropic_messages"
      : "mlx_manage/mlx_lm/anthropic_messages";
  }

  private createAnthropicClient(route: string): Anthropic {
    const localFetch: ClientOptions["fetch"] = async (input, init) => {
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

    return new Anthropic({
      apiKey: "mlx-local",
      baseURL: "http://mlx.local",
      maxRetries: 0,
      fetch: localFetch,
    });
  }

  protected async initParams(
    content: LLMProvider.ResolvedParams,
  ): Promise<MessageStreamParams> {
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

    const openAIMessages = await OpenAIUtil.convertMessagesToOpenAIMessages(
      effectiveOptions,
      content.messages,
      content,
    );
    const { system, messages } = this.convertOpenAIToAnthropic(openAIMessages);

    let temperature = Number(this.options.temperature?.value);
    try {
      temperature =
        typeof temperature === "string" ? parseFloat(temperature) : temperature;
    } catch {
      temperature = 0.5;
    }
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

    const params: MessageStreamParams & {
      chat_template_kwargs?: Record<string, unknown>;
    } = {
      model,
      temperature,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 8192,
      system,
      messages,
      chat_template_kwargs: { enable_thinking: enableThinking },
    };

    if (enableThinking) {
      params.thinking = {
        type: "adaptive",
      } as any;
    } else {
      params.thinking = {
        type: "disabled",
      };
    }

    const tools = AnthropicUtil.convertToolsToAnthropicTools(content.tools);
    if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
      params.tools = tools;
      if (content.tool_choice && typeof content.tool_choice !== "string") {
        params.tool_choice = {
          type: "tool",
          name: content.tool_choice.function.name,
          disable_parallel_tool_use: true,
        } as any;
      } else {
        params.tool_choice = {
          type: "auto",
          disable_parallel_tool_use: true,
        } as any;
      }
    }

    return params as MessageStreamParams;
  }

  private convertOpenAIToAnthropic(messages: any[]): {
    system: TextBlockParam[];
    messages: Anthropic.MessageParam[];
  } {
    const system: TextBlockParam[] = [];
    const conversation: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      const role = message.role;
      if (role === "system" || role === "developer") {
        const text = this.openAIContentToText(message.content);
        if (text) system.push({ type: "text", text });
        continue;
      }

      if (role === "tool") {
        conversation.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.tool_call_id,
              content: this.openAIContentToText(message.content),
            },
          ],
        });
        continue;
      }

      const content = this.openAIContentToAnthropicBlocks(message.content);
      if (role === "assistant" && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          const fn = toolCall.function ?? {};
          let input: unknown = {};
          try {
            input =
              typeof fn.arguments === "string"
                ? JSON.parse(fn.arguments || "{}")
                : fn.arguments || {};
          } catch {
            input = {};
          }
          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: fn.name,
            input,
          } as any);
        }
      }

      if (content.length === 0) continue;
      conversation.push({
        role: role === "assistant" ? "assistant" : "user",
        content:
          content.length === 1 && content[0].type === "text"
            ? content[0].text
            : content,
      } as Anthropic.MessageParam);
    }

    return { system, messages: conversation };
  }

  private openAIContentToText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return content ? JSON.stringify(content) : "";
    return content
      .map((item: any) => {
        if (item?.type === "text") return item.text;
        if (item?.type === "image_url")
          return `[image: ${item.image_url?.url ?? ""}]`;
        if (item?.type === "input_audio") return "[audio]";
        if (item?.type === "audio_url")
          return `[audio: ${item.audio_url?.url ?? ""}]`;
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join("\n");
  }

  private openAIContentToAnthropicBlocks(content: unknown): any[] {
    if (typeof content === "string") {
      return content ? [{ type: "text", text: content }] : [];
    }
    if (!Array.isArray(content)) {
      return content ? [{ type: "text", text: JSON.stringify(content) }] : [];
    }

    const blocks: any[] = [];
    for (const item of content) {
      if (item?.type === "text" && item.text) {
        blocks.push({ type: "text", text: item.text });
      } else if (item?.type === "image_url") {
        const url =
          typeof item.image_url === "string"
            ? item.image_url
            : item.image_url?.url;
        if (url) blocks.push(this.imageBlockFromUrl(url));
      } else if (item?.type === "input_audio") {
        blocks.push({
          type: "input_audio",
          input_audio: item.input_audio,
        });
      } else if (item?.type === "audio_url") {
        blocks.push({
          type: "audio_url",
          audio_url: item.audio_url,
        });
      }
    }
    return blocks;
  }

  private imageBlockFromUrl(url: string): any {
    const dataUrlMatch = url.match(/^data:([^;]+);base64,(.*)$/);
    if (dataUrlMatch) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: dataUrlMatch[1],
          data: dataUrlMatch[2],
        },
      };
    }
    return {
      type: "image",
      source: {
        type: "url",
        url,
      },
    };
  }
}
