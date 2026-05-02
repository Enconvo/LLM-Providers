import OpenAI from "openai";
import axios from "axios";
import { Readable } from "node:stream";
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

function guessVisionFromId(modelId: string): boolean {
  return VISION_NAME_PATTERNS.some((p) => p.test(modelId));
}

async function readNodeStreamAsText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
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
    const url = `${MLX_LOCAL_BASE_URL}/${route}`;

    const axiosResp = await axios.post(
      url,
      { ...params, stream: true, stream_options: { include_usage: true } },
      {
        responseType: "stream",
        signal: content.signal as AbortSignal | undefined,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        validateStatus: () => true,
        maxBodyLength: Infinity,
      },
    );
    if (axiosResp.status < 200 || axiosResp.status >= 300) {
      const errText = await readNodeStreamAsText(axiosResp.data).catch(
        () => `status ${axiosResp.status}`,
      );
      throw new Error(`MLX ${route} failed (${axiosResp.status}): ${errText}`);
    }

    const webBody = Readable.toWeb(axiosResp.data) as ReadableStream<Uint8Array>;
    const fetchLikeResp = new Response(webBody, {
      status: axiosResp.status,
      statusText: axiosResp.statusText,
      headers: new Headers(axiosResp.headers as Record<string, string>),
    });

    const ac = new AbortController();
    const sseStream = Stream.fromSSEResponse<OpenAI.Chat.ChatCompletionChunk>(
      fetchLikeResp,
      ac,
    );
    // @ts-ignore
    return OpenAIUtil.streamFromOpenAI(sseStream, ac, this.options);
  }

  protected async _call(
    content: LLMProvider.ResolvedParams,
  ): Promise<BaseChatMessage> {
    const params = await this.initParams(content);
    const route = await this.routeFor(params.model);
    const url = `${MLX_LOCAL_BASE_URL}/${route}`;

    const axiosResp = await axios.post(
      url,
      { ...params, stream: false },
      {
        signal: content.signal as AbortSignal | undefined,
        headers: { "Content-Type": "application/json" },
        validateStatus: () => true,
        maxBodyLength: Infinity,
      },
    );
    if (axiosResp.status < 200 || axiosResp.status >= 300) {
      const errText =
        typeof axiosResp.data === "string"
          ? axiosResp.data
          : JSON.stringify(axiosResp.data);
      throw new Error(`MLX ${route} failed (${axiosResp.status}): ${errText}`);
    }
    const data = axiosResp.data as {
      choices?: {
        message?: {
          content?: string;
          reasoning_content?: string;
          tool_calls?: {
            id: string;
            type?: string;
            function: { name: string; arguments: string };
          }[];
        };
      }[];
    };
    const message = data?.choices?.[0]?.message ?? {};
    const messageContents: ChatMessageContent[] = [];

    if (message.reasoning_content) {
      messageContents.push(
        ChatMessageContent.thinking({
          content: message.reasoning_content,
          time: 0,
          status: "success",
        }),
      );
    }

    if (message.content) {
      messageContents.push({ type: "text", text: message.content });
    }

    if (message.tool_calls?.length) {
      for (const tc of message.tool_calls) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          input = {};
        }
        messageContents.push(
          new ChatMessageContentToolUse(tc.function.name, input, tc.id),
        );
      }
    }

    return new AssistantMessage({ content: messageContents });
  }

  private async routeFor(modelId: string): Promise<string> {
    const isVision = await this.detectVision(modelId);
    return isVision
      ? "mlx_manage/mlx_vlm/stream_chat"
      : "mlx_manage/mlx_lm/stream_chat";
  }

  protected async initParams(content: LLMProvider.ResolvedParams) {
    const modelOptions = this.options.modelName;

    const messages = await OpenAIUtil.convertMessagesToOpenAIMessages(
      this.options,
      content.messages,
      content,
    );

    const tools = OpenAIUtil.convertToolsToOpenAITools(content.tools);

    let temperature = this.options.temperature?.value;
    try {
      temperature =
        typeof temperature === "string" ? parseFloat(temperature) : temperature;
    } catch {
      temperature = 0.5;
    }

    const reasoningEffort =
      this.options?.reasoning_effort?.value ||
      this.options?.reasoning_effort_new?.value;
    const enableThinking = Boolean(reasoningEffort) && reasoningEffort !== "off";

    const params: any = {
      model: modelOptions?.value,
      temperature,
      messages,
      chat_template_kwargs: { enable_thinking: enableThinking },
    };

    if (tools && tools.length > 0 && modelOptions?.toolUse === true) {
      params.tools = tools;
      params.tool_choice = content.tool_choice;
      params.parallel_tool_calls = false;
    }

    return params;
  }
}
