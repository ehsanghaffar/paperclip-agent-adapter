# Paperclip Custom Adapter 

Paperclip adapter for custom OpenAI-compatible, OpenAI Responses, and Anthropic-compatible LLM endpoints.

## Overview

This adapter allows Paperclip to connect to any LLM API that implements one of three standard endpoint shapes:

- **OpenAI Chat Completions** (`chat/completions`) - The standard OpenAI chat completion format
- **OpenAI Responses** (`responses`) - OpenAI's newer Responses API format
- **Anthropic Messages** (`messages`) - Anthropic's Messages API format (Claude-compatible)

The adapter is stateless — it makes a single HTTP request per execution with no server-side session persistence. Conversation continuity (if needed) must be reconstructed client-side by replaying prior messages.

## Requirements

- Node.js >= 24.11.0
- A Paperclip deployment (cloud or self-hosted)
- An API key for your custom LLM endpoint

## Installation

```bash
npm install paperclip-custom-adapter
```

## Paperclip Setup

1. In Paperclip, create a new agent with adapter type `custom_llm`
2. Configure the following fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `endpointPath` | select | No | `chat/completions` | Which endpoint to call: `chat/completions`, `responses`, or `messages`. |
| `model` | text | Yes | — | Model identifier sent verbatim to the endpoint. |
| `baseUrl` | text | Yes | — | Absolute `http`/`https` URL for the API (e.g. `https://api.your-provider.com/v1`). |
| `apiKeyEnv` | text | No | — | Name of the server environment variable holding the API key. If omitted, falls back to the injected Paperclip auth token. |
| `requestTimeoutMs` | number | No | `30000` | Request timeout in milliseconds. |
| `extraHeaders` | object | No | — | Additional HTTP headers sent with each request. |
| `promptTemplate` | textarea | No | Paperclip default | Custom prompt template using `{{variable}}` syntax (e.g. `{{agent.name}}`, `{{runId}}`, `{{context}}`). Uses Paperclip's default agent prompt if omitted. |

> **Security:** Never put raw API keys in adapter config. Use `apiKeyEnv` to reference a server environment variable instead.

## Supported Models

The adapter ships with no built-in model options (`models` is empty by default). Pass any model identifier via the `model` config field, or extend the `models` export in `src/metadata.ts` to populate the model selector in the Paperclip UI.

## Configuration Examples

### Using with a custom OpenAI-compatible endpoint

```json
{
  "endpointPath": "chat/completions",
  "model": "gpt-4o",
  "baseUrl": "https://api.your-provider.com/v1",
  "apiKeyEnv": "MY_API_KEY"
}
```

### Using with Anthropic-compatible endpoint (Claude)

```json
{
  "endpointPath": "messages",
  "model": "claude-3-opus",
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKeyEnv": "ANTHROPIC_API_KEY"
}
```

### Using with OpenAI Responses API

```json
{
  "endpointPath": "responses",
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyEnv": "OPENAI_API_KEY"
}
```

### With custom headers and prompt template

```json
{
  "endpointPath": "chat/completions",
  "model": "my-model",
  "baseUrl": "https://api.local/v1",
  "apiKeyEnv": "LOCAL_API_KEY",
  "requestTimeoutMs": 60000,
  "extraHeaders": {
    "X-Custom-Header": "value"
  },
  "promptTemplate": "You are {{agent.name}}. Context: {{context}}"
}
```

## Request Body Shapes

Depending on `endpointPath`, the adapter sends one of the following bodies:

**`chat/completions`**
```json
{
  "model": "gpt-4o",
  "messages": [{ "role": "user", "content": "<prompt>" }]
}
```

**`responses`**
```json
{
  "model": "gpt-4o",
  "input": "<prompt>"
}
```

**`messages` (Anthropic-compatible)**
```json
{
  "model": "claude-3-opus",
  "max_tokens": 4096,
  "messages": [{ "role": "user", "content": "<prompt>" }]
}
```

## Response Parsing

The adapter extracts text from responses in this order per endpoint shape:

- **chat/completions** — `choices[0].message.content` (falls back to legacy `choices[0].text`)
- **responses** — `output_text` (falls back to `output[].content[].text`)
- **messages** — `content[].text` (Anthropic content blocks)

Token usage is read from `usage.prompt_tokens`/`usage.completion_tokens` (OpenAI) or `usage.input_tokens`/`usage.output_tokens` (Anthropic). Cached input tokens are captured when present.

## Error Handling

| Condition | Error Family |
|-----------|--------------|
| Network failure / unreachable endpoint | `transient_upstream` |
| Request timeout | `transient_upstream` |
| HTTP 401 / 403 | `provider_quota` |
| HTTP 429 | `provider_quota` (retry delayed 60s) |
| Other HTTP errors | `transient_upstream` |

## Environment Variables

The adapter respects these environment variables at runtime:

| Variable | Description |
|----------|-------------|
| `DEFAULT_BASE_URL` | Default base URL if `baseUrl` is not specified in config. |

## CLI

The package exports a CLI helper (`@paperclipai/custom-adapter/cli` or `./cli`) that pretty-prints provider stdout events, including assistant text (green), usage counts (blue), and provider errors (red).

## Development

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

### Test

```bash
npm run test
### Tests

```bash
npm run test        # Run tests once
npm run test:watch  # Watch mode
```

### Package

```bash
npm pack --dry-run  # Inspect package contents
```

## Project Structure

```
src/
├── index.ts           # Main entrypoint - exports createServerAdapter
├── metadata.ts        # Adapter metadata (type, label, models, config doc)
├── ui-parser.ts       # Browser-safe stdout parser for Paperclip UI
├── server/
│   ├── index.ts       # createServerAdapter factory
│   ├── execute.ts     # Main execution logic
│   ├── test.ts        # Environment validation (no network calls)
│   └── parse.ts       # Response parsing for all three endpoint types
└── cli/
    ├── index.ts       # CLI exports
    └── format-event.ts # Human-readable stdout formatter
```

## How It Works

### Execution Flow

1. Paperclip calls `createServerAdapter()` to get the adapter module
2. On each run, `execute(ctx)` is called with:
   - Agent config (apiKey, model, endpointPath, baseUrl, timeoutSec)
   - Run context (runId, agent info, context variables)
   - Callbacks for logging (`onLog`), metadata (`onMeta`), events (`onEvent`)
3. The adapter:
   - Builds the prompt using the template (default or custom)
   - Constructs the request body based on `endpointPath`
   - Makes an HTTP POST request with Bearer auth
   - Parses the response based on endpoint type
   - Returns structured `AdapterExecutionResult`

### Response Parsing

The adapter handles three response formats:

**OpenAI Chat Completions** (`chat/completions`):
```json
{ "choices": [{ "message": { "content": "..." } }], "usage": {...} }
```

**OpenAI Responses** (`responses`):
```json
{ "output_text": "...", "usage": {...} }
```
Or with `output` array:
```json
{ "output": [{ "content": [{ "type": "output_text", "text": "..." }] }] }
```

**Anthropic Messages** (`messages`):
```json
{ "content": [{ "type": "text", "text": "..." }], "usage": {...} }
```

### UI Parser

The `./ui-parser` export provides a browser-safe `parseStdoutLine(line, ts)` function that converts raw JSON response lines into structured transcript entries for the Paperclip UI. It handles all three endpoint formats and falls back to `stdout` for unrecognized content.

### CLI Formatter

The `./cli` export provides `formatStdoutEvent(line, debug)` for human-readable terminal output during development.

## Error Handling

The adapter classifies errors into families for Paperclip's retry logic:

| HTTP Status | Error Family | Retry Behavior |
|-------------|--------------|----------------|
| 401, 403 | `provider_quota` | No retry (auth issue) |
| 429 | `provider_quota` | Retry after `retryNotBefore` (60s) |
| Timeout | `transient_upstream` | Retryable |
| Network error | `transient_upstream` | Retryable |
| Other 4xx/5xx | `transient_upstream` | Retryable |

## Limitations

- **No server-side sessions**: The adapter is stateless. Multi-turn conversations require client-side message history replay.
- **No tool calling**: The endpoint shapes don't define a standard tool/function calling format. If your custom API supports tools, you'll need to extend the parser.
- **Single request per execution**: Each Paperclip run = one HTTP request. No streaming support.
- **No model discovery**: Models are statically defined in `metadata.ts`. Add your own models there.

## Extending the Adapter

### Adding Custom Models

Edit `src/metadata.ts`:

```typescript
export const models = [
  { id: "auto", label: "Auto (recommended)" },
  { id: "your-model-id", label: "Your Model Name" },
  // ...
];
```

### Adding Custom Endpoints

Edit `src/metadata.ts`:

```typescript
export const endpointPaths = [
  { label: "Chat Completions (OpenAI)", value: "chat/completions" },
  { label: "Responses (OpenAI)", value: "responses" },
  { label: "Messages (Anthropic-compatible)", value: "messages" },
  { label: "Your Custom Endpoint", value: "your/custom/path" },
];
```

Then update `src/server/execute.ts` to handle the new endpoint in `buildRequestBody()` and `src/server/parse.ts` in `parseProviderResponse()`.

### Custom Prompt Templates

Set the `promptTemplate` config field with `{{variable}}` placeholders. Available variables:

- `agentId`, `companyId`, `runId`
- `agent` (object with id, name, adapterType, adapterConfig)
- `run` (object with id)
- `context` (the run context object)

## Security

- API keys are never logged (only metadata about the request is sent via `onMeta`)
- No credentials are stored in the package
- Uses environment variables only for non-secret defaults
- All network requests use HTTPS (configure `baseUrl` with `https://`)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Support

- Paperclip Documentation: https://docs.paperclip.ing
- Issues: https://github.com/paperclipai/paperclip/issues