import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execute } from "../../src/server/execute.js";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

// Mock fetch globally
const originalFetch = global.fetch;

describe("execute", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const createMockContext = (overrides: Partial<AdapterExecutionContext> = {}): AdapterExecutionContext => ({
    runId: "test-run-123",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      adapterType: "custom",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      apiKey: "test-api-key",
      model: "auto",
      endpointPath: "chat/completions",
      baseUrl: "https://api.example.com/v1",
      timeoutSec: 120,
    },
    context: {},
    onLog: vi.fn(),
    onMeta: vi.fn(),
    authToken: "injected-auth-token",
    ...overrides,
  });

  it("returns error when apiKey is missing and no authToken", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, apiKey: "" },
      authToken: undefined,
    });

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toContain("missing apiKey");
    expect(result.errorFamily).toBe("provider_quota");
  });

  it("uses authToken when apiKey is not provided", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, apiKey: "" },
      authToken: "injected-token",
    });

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: "Hello" } }],
        model: "test-model",
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer injected-token",
        }),
      })
    );
  });

  it("successfully executes with chat/completions endpoint", async () => {
    const ctx = createMockContext();

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: "Test response" } }],
        model: "gpt-4",
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("Test response");
    expect(result.model).toBe("gpt-4");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.provider).toBe("custom");
  });

  it("successfully executes with responses endpoint", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, endpointPath: "responses" },
    });

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        output_text: "Responses API response",
        model: "gpt-4o",
        usage: { input_tokens: 15, output_tokens: 25 },
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("Responses API response");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/responses",
      expect.any(Object)
    );
  });

  it("successfully executes with messages endpoint", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, endpointPath: "messages" },
    });

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        content: [{ type: "text", text: "Anthropic response" }],
        model: "claude-3-opus",
        usage: { input_tokens: 12, output_tokens: 18 },
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("Anthropic response");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/messages",
      expect.any(Object)
    );
  });

  it("handles HTTP error responses", async () => {
    const ctx = createMockContext();

    const mockResponse = {
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toContain("HTTP 401");
    expect(result.errorFamily).toBe("provider_quota");
  });

  it("handles rate limit with retryNotBefore", async () => {
    const ctx = createMockContext();

    const mockResponse = {
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorFamily).toBe("provider_quota");
    expect(result.retryNotBefore).toBeDefined();
  });

  it("handles network errors", async () => {
    const ctx = createMockContext();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toContain("Network error");
    expect(result.errorFamily).toBe("transient_upstream");
  });

  it("handles timeout", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, timeoutSec: 1 },
    });

    // Create an AbortError
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(true);
    expect(result.errorFamily).toBe("transient_upstream");
  });

  it("handles invalid JSON response", async () => {
    const ctx = createMockContext();

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve("not valid json"),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toContain("not valid JSON");
    expect(result.errorFamily).toBe("transient_upstream");
  });

  it("calls onMeta with correct metadata", async () => {
    const ctx = createMockContext();
    const onMeta = vi.fn();
    ctx.onMeta = onMeta;

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: "Test" } }],
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await execute(ctx);

    expect(onMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterType: "custom",
        command: "fetch",
        commandArgs: ["https://api.example.com/v1/chat/completions"],
        prompt: expect.any(String),
        promptMetrics: { characters: expect.any(Number) },
        context: {
          model: "auto",
          endpoint: "chat/completions",
          baseUrl: "https://api.example.com/v1",
        },
      })
    );
  });

  it("uses custom baseUrl from config", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, baseUrl: "https://custom.example.com/v1" },
    });

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: "Test" } }],
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await execute(ctx);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.example.com/v1/chat/completions",
      expect.any(Object)
    );
  });

  it("uses custom timeout from config", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, timeoutSec: 30 },
    });

    const mockResponse = {
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: "Test" } }],
      })),
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await execute(ctx);

    // Just verify it doesn't throw and completes
    expect(ctx.onLog).toHaveBeenCalled();
  });
});