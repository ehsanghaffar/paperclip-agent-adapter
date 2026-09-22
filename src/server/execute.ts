import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import type { AdapterExecutionErrorFamily } from "@paperclipai/adapter-utils/types";
import { asString, asNumber, renderTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE } from "@paperclipai/adapter-utils/server-utils";
import { parseProviderResponse, type EndpointType } from "./parse.js";
import { DEFAULT_BASE_URL } from "../metadata.js";
const DEFAULT_ENDPOINT: EndpointType = "chat/completions";

function resolveEndpoint(config: Record<string, unknown>): EndpointType {
  const ep = asString(config.endpointPath, DEFAULT_ENDPOINT);
  if (ep === "responses" || ep === "messages") return ep;
  return "chat/completions";
}

function buildRequestBody(
  endpoint: EndpointType,
  model: string,
  promptText: string,
): Record<string, unknown> {
  if (endpoint === "messages") {
    // Anthropic-compatible schema — max_tokens is required.
    return {
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: promptText }],
    };
  }
  if (endpoint === "responses") {
    return { model, input: promptText };
  }
  return {
    model,
    messages: [{ role: "user", content: promptText }],
  };
}

function buildPromptText(ctx: AdapterExecutionContext): string {
  const { config, agent, runId, context } = ctx;
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE);

  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    agent: {
      id: agent.id,
      name: agent.name,
      adapterType: agent.adapterType,
      adapterConfig: agent.adapterConfig,
    },
    run: { id: runId },
    context,
  };

  return renderTemplate(promptTemplate, templateData);
}

function classifyError(status: number | null, isTimeout: boolean, isNetworkError: boolean): AdapterExecutionErrorFamily | null {
  if (isTimeout) return "transient_upstream";
  if (isNetworkError) return "transient_upstream";
  if (status === 401 || status === 403) return "provider_quota";
  if (status === 429) return "provider_quota";
  return null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, onLog, onMeta, authToken, agent, runId } = ctx;

  const apiKey = asString(config.apiKey, "") || authToken || "";
  const model = asString(config.model, "auto");
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutSec = asNumber(config.timeoutSec, 120);
  const endpoint = resolveEndpoint(config);

  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "llm adapter: missing apiKey (set config.apiKey, or rely on the injected auth token)",
      errorFamily: "provider_quota",
      provider: "custom",
      model,
    };
  }

  const promptText = buildPromptText(ctx);
  if (!promptText) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "llm adapter: failed to render prompt template",
      errorFamily: "transient_upstream",
      provider: "custom",
      model,
    };
  }

  const url = `${baseUrl}/${endpoint}`;
  const body = buildRequestBody(endpoint, model, promptText);

  await onMeta?.({
    adapterType: "custom",
    command: "fetch",
    commandArgs: [url],
    prompt: promptText,
    promptMetrics: { characters: promptText.length },
    context: { model, endpoint, baseUrl },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  let res: Response;
  let isNetworkError = false;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const message = err instanceof Error ? err.message : String(err);
    isNetworkError = !isAbort;
    await onLog("stderr", `llm adapter: fetch failed — ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: isAbort,
      errorMessage: isAbort ? "llm adapter: request timed out" : message,
      errorFamily: classifyError(null, isAbort, isNetworkError),
      provider: "custom",
      model,
    };
  }
  clearTimeout(timer);

  const rawText = await res.text();
  await onLog("stdout", rawText + "\n");

  if (!res.ok) {
    await onLog("stderr", `llm adapter: HTTP ${res.status}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `llm adapter: HTTP ${res.status} — ${rawText.slice(0, 2000)}`,
      errorFamily: classifyError(res.status, false, false),
      retryNotBefore: res.status === 429 ? new Date(Date.now() + 60_000).toISOString() : undefined,
      provider: "custom",
      model,
    };
  }

  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    // parseResponse handles null json defensively.
  }

  const parsed = parseProviderResponse(endpoint, json);

  return {
    exitCode: parsed.isError ? 1 : 0,
    signal: null,
    timedOut: false,
    errorMessage: parsed.errorMessage ?? null,
    errorFamily: parsed.isError ? "transient_upstream" : null,
    usage: parsed.usage,
    sessionId: null,
    sessionParams: null,
    sessionDisplayId: null,
    provider: "custom",
    model: parsed.model ?? model,
    costUsd: null,
    resultJson: json,
    summary: parsed.summary ?? null,
    clearSession: false,
  };
}
