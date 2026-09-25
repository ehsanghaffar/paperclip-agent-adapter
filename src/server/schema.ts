import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { asString, asNumber, parseObject } from "@paperclipai/adapter-utils/server-utils";


export type EndpointType = "chat/completions" | "responses" | "messages";

export const endpointPaths = [
  { label: "Chat Completions (OpenAI)", value: "chat/completions" },
  { label: "Responses (OpenAI)", value: "responses" },
  { label: "Messages (Anthropic-compatible (Claude))", value: "messages" },
];

const DEFAULT_ENDPOINT: EndpointType = "chat/completions";

function resolveEndpoint(config: Record<string, unknown>): EndpointType {
  const ep = asString(config.endpointPath, DEFAULT_ENDPOINT);
  if (ep === "responses" || ep === "messages") return ep;
  return "chat/completions";
}

export interface CustomLlmLocalConfig {
  model: string;
  baseUrl: string;
  apiKeyEnv: string | null;
  requestTimeoutMs: number;
  endpoint: EndpointType;
}

export function parseConfig(raw: Record<string, unknown>): CustomLlmLocalConfig {
  if ("apiKey" in raw && raw.apiKey != null && raw.apiKey !== "") {
    throw new Error("CONFIG_INVALID: raw apiKey is not supported; use apiKeyEnv instead");
  }

  const model = asString(raw.model, "").trim();
  if (!model) throw new Error("CONFIG_INVALID: model is required");

  const baseUrl = asString(raw.baseUrl, "").trim();
  if (!baseUrl) throw new Error("CONFIG_INVALID: baseUrl is required");
  try {
    const parsedBaseUrl = new URL(baseUrl);
    if ((parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") || !parsedBaseUrl.host) {
      throw new Error("invalid protocol or host");
    }
  } catch {
    throw new Error("CONFIG_INVALID: baseUrl must be an absolute http/https URL");
  }

  const apiKeyEnv = asString(raw.apiKeyEnv, "").trim() || null;
  const requestTimeoutMs = asNumber(raw.requestTimeoutMs, 30000);

  const rawHeaders = parseObject(raw.extraHeaders);
  const extraHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === "string") extraHeaders[key] = value;
  }

  const endpoint = resolveEndpoint(raw.endpointPath ? { endpointPath: raw.endpointPath } : {});

  return { model, baseUrl, apiKeyEnv, requestTimeoutMs, endpoint };
}

export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "endpointPath",
        label: "Endpoint",
        type: "select",
        default: "chat/completions",
        options: endpointPaths.map((endpoint) => ({
          label: endpoint.label,
          value: endpoint.value,
        })),
        hint: "Which custom endpoint to call.",
      },
      {
        key: "model",
        label: "Model ID",
        type: "text",
        required: true,
        hint: "Sent verbatim to the endpoint",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "text",
        required: true,
        hint: "Absolute endpoint URL, for example http://127.0.0.1:8080/v1",
      },
      {
        key: "apiKeyEnv",
        label: "API Key Env Var",
        type: "text",
        hint: "Name of the environment variable holding the API key",
      },
      {
        key: "requestTimeoutMs",
        label: "Request Timeout (ms)",
        type: "number",
        default: 30000,
      },
    ],
  };
}
