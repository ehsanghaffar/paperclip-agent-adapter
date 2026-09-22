import { describe, it, expect } from "vitest";
import { parseStdoutLine } from "../src/ui-parser.js";

describe("ui-parser parseStdoutLine", () => {
  const ts = "2024-01-01T00:00:00.000Z";

  it("returns empty array for empty line", () => {
    expect(parseStdoutLine("", ts)).toEqual([]);
    expect(parseStdoutLine("   ", ts)).toEqual([]);
  });

  it("returns stdout entry for non-JSON line", () => {
    const result = parseStdoutLine("plain text output", ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "stdout", ts, text: "plain text output" });
  });

  it("parses OpenAI chat/completions response", () => {
    const json = JSON.stringify({
      choices: [{ message: { content: "Hello, world!" } }],
      model: "gpt-4",
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "assistant", ts, text: "Hello, world!" });
  });

  it("parses OpenAI chat/completions legacy text response", () => {
    const json = JSON.stringify({
      choices: [{ text: "Legacy response" }],
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "assistant", ts, text: "Legacy response" });
  });

  it("parses OpenAI Responses API output_text", () => {
    const json = JSON.stringify({
      output_text: "Response from Responses API",
      model: "gpt-4o",
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "assistant", ts, text: "Response from Responses API" });
  });

  it("parses OpenAI Responses API output array", () => {
    const json = JSON.stringify({
      output: [
        { type: "message", content: [{ type: "output_text", text: "Part 1" }] },
        { type: "message", content: [{ type: "output_text", text: "Part 2" }] },
      ],
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "assistant", ts, text: "Part 1Part 2" });
  });

  it("parses Anthropic Messages response", () => {
    const json = JSON.stringify({
      content: [{ type: "text", text: "Hello from Anthropic" }],
      model: "claude-3-opus",
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "assistant", ts, text: "Hello from Anthropic" });
  });

  it("parses error response as system entry", () => {
    const json = JSON.stringify({
      error: { message: "Invalid API key" },
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      kind: "system",
      ts,
      text: "custom provider error: Invalid API key",
    });
  });

  it("parses error response as string", () => {
    const json = JSON.stringify({
      error: "Simple error",
    });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      kind: "system",
      ts,
      text: "custom provider error: Simple error",
    });
  });

  it("returns stdout for JSON without recognized content", () => {
    const json = JSON.stringify({ unknown: "field" });
    const result = parseStdoutLine(json, ts);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("stdout");
    if (result[0].kind === "stdout") {
      expect(result[0].text).toBe(json);
    }
  });

  it("handles malformed JSON gracefully", () => {
    const result = parseStdoutLine("{ not valid json", ts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "stdout", ts, text: "{ not valid json" });
  });

  it("never throws on any input", () => {
    const inputs = [
      "",
      "plain text",
      "{ invalid json",
      "{}",
      '{"choices":[]}',
      '{"choices":[{}]}',
      '{"output_text":null}',
      '{"content":[]}',
      '{"error":{}}',
    ];

    for (const input of inputs) {
      expect(() => parseStdoutLine(input, ts)).not.toThrow();
      const result = parseStdoutLine(input, ts);
      expect(Array.isArray(result)).toBe(true);
    }
  });
});