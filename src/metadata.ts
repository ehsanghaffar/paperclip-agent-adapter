// Shared adapter metadata. Kept in its own file so src/index.ts and
// src/server/index.ts can both import it without creating a circular
// dependency (index.ts re-exports createServerAdapter FROM server/index.ts,
// so server/index.ts must not import metadata back from index.ts).

// DEFAULT_BASE_URL can be overridden via adapter config (baseUrl field)
// or the DEFAULT_BASE_URL environment variable at runtime.
export const DEFAULT_BASE_URL = "";

export const type = "custom";
export const label = "custom LLM";

export const models = [
  { id: "auto", label: "Auto (recommended)" },
  { id: "nemotron-3-120b", label: "Nemotron 3 120B" },
  { id: "dots3-note-preview", label: "Dots3 Note Preview" },
  // add your own custom api models.
];

export const endpointPaths = [
  { label: "Chat Completions (OpenAI)", value: "chat/completions" },
  { label: "Responses (OpenAI)", value: "responses" },
  { label: "Messages (Anthropic-compatible (Claude))", value: "messages" },
  // add your custom endpoint
];

export const agentConfigurationDoc = `# custom agent configuration

Adapter: custom

this llm is a hosted, stateless HTTP completion API (OpenAI-compatible chat/
completions and responses endpoints, plus an Anthropic-compatible messages
endpoint) at https://example.com/v1. It is not a local CLI agent runtime: it
has no filesystem access, no confirmed tool use / function calling, and no
server-side session or thread persistence.

Use when:
- The task is a single-shot (or manually-replayed-history) chat completion
  against a hosted LLM behind one custom API key
- You want "model": "auto" to let the backend choose the underlying model
- You need to call an OpenAI-shaped, an OpenAI Responses-shaped, or an
  Anthropic Messages-shaped endpoint through one adapter

Don't use when:
- The task needs a local coding-agent runtime with filesystem/tool access
  (use a local CLI adapter instead)
- You need multi-turn conversation continuity guaranteed by the provider —
  custom has no server-side session; continuity (if needed) must be
  reconstructed client-side by replaying prior messages

Core fields:
- apiKey (string, required, secret): Bearer token sent as
  \`Authorization: Bearer <apiKey>\`. Falls back to the injected Paperclip
  auth token if omitted — never put this in a prompt template.
- model (string, default "auto"): passed as the request's "model" field.
- endpointPath (enum: "chat/completions" | "responses" | "messages",
  default "chat/completions"): which custom endpoint to call.
- baseUrl (string, default "https://example.com/v1"): override for testing
  against a staging host.
- requestTimeoutMs (number, default 30000): timeout for the HTTP request
`;
