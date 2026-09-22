import { describe, it, expect } from "vitest";
import { parseProviderResponse, type EndpointType } from "../../src/server/parse.js";

describe("parseProviderResponse", () => {
  const testCases: Array<{
    name: string;
    endpoint: EndpointType;
    json: Record<string, unknown> | null;
    expected: {
      isError?: boolean;
      summary?: string | null;
      model?: string | null;
      usage?: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
      errorMessage?: string;
    };
  }> = [
    {
      name: "chat/completions - valid response with choices",
      endpoint: "chat/completions",
      json: {
        choices: [{ message: { content: "Hello, world!" } }],
        model: "gpt-4",
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      },
      expected: {
        isError: false,
        summary: "Hello, world!",
        model: "gpt-4",
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    },
    {
      name: "chat/completions - valid response with text (legacy)",
      endpoint: "chat/completions",
      json: {
        choices: [{ text: "Legacy text response" }],
        model: "gpt-3.5-turbo",
      },
      expected: {
        isError: false,
        summary: "Legacy text response",
        model: "gpt-3.5-turbo",
      },
    },
    {
      name: "chat/completions - error response",
      endpoint: "chat/completions",
      json: {
        error: { message: "Invalid API key", type: "auth_error" },
      },
      expected: {
        isError: true,
        errorMessage: "custom API error: Invalid API key",
      },
    },
    {
      name: "responses - valid response with output_text",
      endpoint: "responses",
      json: {
        output_text: "Response from OpenAI Responses API",
        model: "gpt-4o",
        usage: { input_tokens: 15, output_tokens: 25 },
      },
      expected: {
        isError: false,
        summary: "Response from OpenAI Responses API",
        model: "gpt-4o",
        usage: { inputTokens: 15, outputTokens: 25 },
      },
    },
    {
      name: "responses - valid response with output array",
      endpoint: "responses",
      json: {
        output: [
          { type: "message", content: [{ type: "output_text", text: "Part 1" }] },
          { type: "message", content: [{ type: "output_text", text: "Part 2" }] },
        ],
        model: "gpt-4o",
      },
      expected: {
        isError: false,
        summary: "Part 1Part 2",
        model: "gpt-4o",
      },
    },
    {
      name: "messages - valid Anthropic response",
      endpoint: "messages",
      json: {
        content: [{ type: "text", text: "Hello from Anthropic" }],
        model: "claude-3-opus",
        usage: { input_tokens: 12, output_tokens: 18, cache_read_input_tokens: 5 },
      },
      expected: {
        isError: false,
        summary: "Hello from Anthropic",
        model: "claude-3-opus",
        usage: { inputTokens: 12, outputTokens: 18, cachedInputTokens: 5 },
      },
    },
    {
      name: "messages - error response",
      endpoint: "messages",
      json: {
        error: { message: "Rate limit exceeded", type: "rate_limit_error" },
      },
      expected: {
        isError: true,
        errorMessage: "custom API error: Rate limit exceeded",
      },
    },
    {
      name: "null json returns error",
      endpoint: "chat/completions",
      json: null,
      expected: {
        isError: true,
        errorMessage: "custom adapter: response body was not valid JSON",
      },
    },
    {
      name: "empty json returns no summary but not error",
      endpoint: "chat/completions",
      json: {},
      expected: {
        isError: false,
        summary: null,
      },
    },
    {
      name: "chat/completions - error as string",
      endpoint: "chat/completions",
      json: {
        error: "Simple error string",
      },
      expected: {
        isError: true,
        errorMessage: "custom API error: Simple error string",
      },
    },
  ];

  for (const tc of testCases) {
    it(tc.name, () => {
      const result = parseProviderResponse(tc.endpoint, tc.json);
      expect(result.isError).toBe(tc.expected.isError ?? false);
      if (tc.expected.summary !== undefined) {
        expect(result.summary).toBe(tc.expected.summary);
      }
      if (tc.expected.model !== undefined) {
        expect(result.model).toBe(tc.expected.model);
      }
      if (tc.expected.usage !== undefined) {
        expect(result.usage).toEqual(tc.expected.usage);
      }
      if (tc.expected.errorMessage !== undefined) {
        expect(result.errorMessage).toBe(tc.expected.errorMessage);
      }
    });
  }
});