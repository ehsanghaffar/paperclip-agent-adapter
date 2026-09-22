# paperclip-custom-adapter

Paperclip adapter for custom OpenAI-compatible, OpenAI Responses, and Anthropic-compatible LLM endpoints.

## Overview

This adapter allows Paperclip to connect to any LLM API that implements one of three standard endpoint shapes:

- **OpenAI Chat Completions** (`/v1/chat/completions`) - The standard OpenAI chat completion format
- **OpenAI Responses** (`/v1/responses`) - OpenAI's newer Responses API format
- **Anthropic Messages** (`/v1/messages`) - Anthropic's Messages API format (Claude-compatible)

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

1. In Paperclip, create a new agent with adapter type `custom`
2. Configure the following fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `apiKey` | string (secret) | Yes | — | Bearer token sent as `Authorization: Bearer <apiKey>`. Falls back to injected Paperclip auth token if omitted. |
| `model` | select | No | `auto` | Model identifier passed in the request body. |
| `endpointPath` | select | No | `chat/completions` | Which endpoint to call: `chat/completions`, `responses`, or `messages`. |
| `baseUrl` | string | No | `https://api.openai.com/v1` | Base URL for the API (e.g., `https://your-custom-api.com/v1`). |
| `timeoutSec` | number | No | `120` | Request timeout in seconds. |
| `promptTemplate` | textarea | No | — | Custom prompt template using `{{variable}}` syntax. Uses Paperclip's default agent prompt if omitted. |

## Supported Models

The adapter includes these built-in model options:

- `auto` (Auto - recommended) — Let the backend choose the model
- `nemotron-3-120b` — Nemotron 3 120B
- `dots3-note-preview` — Dots3 Note Preview

You can add custom models by modifying the `models` export in `metadata.ts`.

## Configuration Examples

### Using with a custom OpenAI-compatible endpoint

```json
{
  "apiKey": "sk-your-custom-key",
  "model": "auto",
  "endpointPath": "chat/completions",
  "baseUrl": "https://api.your-provider.com/v1"
}
```

### Using with Anthropic-compatible endpoint (Claude)

```json
{
  "apiKey": "sk-ant-your-key",
  "model": "claude-3-opus",
  "endpointPath": "messages",
  "baseUrl": "https://api.anthropic.com/v1"
}
```

### Using with OpenAI Responses API

```json
{
  "apiKey": "sk-your-key",
  "model": "gpt-4o",
  "endpointPath": "responses",
  "baseUrl": "https://api.openai.com/v1"
}
```

## Environment Variables

The adapter respects these environment variables at runtime:

| Variable | Description |
|----------|-------------|
| `DEFAULT_BASE_URL` | Default base URL if not specified in config |

## Development

### Build

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

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

- Paperclip Documentation: https://paperclip.ai/docs
- Issues: https://github.com/paperclipai/paperclip/issues