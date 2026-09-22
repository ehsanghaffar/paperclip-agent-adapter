// Parses custom API response bodies into structured data.
//
// my adapter exposes three response shapes depending on which endpoint was called:
//   - /v1/chat/completions -> OpenAI chat.completion shape
//   - /v1/responses        -> OpenAI Responses shape
//   - /v1/messages         -> Anthropic Messages shape
//
// Treat the response body as untrusted: only extract known fields
// defensively, never eval/execute anything from it.

export type EndpointType = "chat/completions" | "responses" | "messages";

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ProviderParsedResult {
  summary: string | null;
  usage?: ProviderUsage;
  model?: string | null;
  isError: boolean;
  errorMessage?: string | null;
}

function safeString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function extractOpenAiChatText(json: any): string | undefined {
  const choice = json?.choices?.[0];
  return safeString(choice?.message?.content) ?? safeString(choice?.text);
}

function extractOpenAiResponsesText(json: any): string | undefined {
  const direct = safeString(json?.output_text);
  if (direct) return direct;

  const out = json?.output;
  if (Array.isArray(out)) {
    const parts = out
      .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
      .filter((c: any) => c?.type === "output_text" || c?.type === "text")
      .map((c: any) => c?.text)
      .filter((t: unknown) => typeof t === "string");
    if (parts.length) return parts.join("");
  }
  return undefined;
}

function extractAnthropicText(json: any): string | undefined {
  const content = json?.content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c?.text)
      .filter((t: unknown) => typeof t === "string");
    if (parts.length) return parts.join("");
  }
  return undefined;
}

function extractUsage(json: any, endpoint: EndpointType): ProviderUsage | undefined {
  const usage = json?.usage;
  if (!usage || typeof usage !== "object") return undefined;

  if (endpoint === "messages") {
    const inputTokens = Number(usage.input_tokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? 0);
    const cached = usage.cache_read_input_tokens;
    return {
      inputTokens,
      outputTokens,
      cachedInputTokens: cached != null ? Number(cached) : undefined,
    };
  }

  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const cached = usage.prompt_tokens_details?.cached_tokens;
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: cached != null ? Number(cached) : undefined,
  };
}

export function parseProviderResponse(
  endpoint: EndpointType,
  json: Record<string, unknown> | null,
): ProviderParsedResult {
  if (!json) {
    return {
      summary: null,
      isError: true,
      errorMessage: "custom adapter: response body was not valid JSON",
    };
  }

  const errObj = (json as any).error;
  if (errObj) {
    const msg =
      typeof errObj === "string" ? errObj : safeString(errObj?.message) ?? JSON.stringify(errObj);
    return { summary: null, isError: true, errorMessage: `custom API error: ${msg}` };
  }

  let text: string | undefined;
  if (endpoint === "messages") text = extractAnthropicText(json);
  else if (endpoint === "responses") text = extractOpenAiResponsesText(json);
  else text = extractOpenAiChatText(json);

  return {
    summary: text ?? null,
    usage: extractUsage(json, endpoint),
    model: safeString((json as any).model) ?? null,
    isError: false,
  };
}
