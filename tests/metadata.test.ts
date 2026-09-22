import { describe, it, expect } from "vitest";
import { type, label, models, endpointPaths, agentConfigurationDoc, DEFAULT_BASE_URL } from "../src/metadata.js";

describe("metadata", () => {
  it("exports correct adapter type", () => {
    expect(type).toBe("custom");
  });

  it("exports correct adapter label", () => {
    expect(label).toBe("custom LLM");
  });

  it("exports models array with expected entries", () => {
    expect(models).toEqual([
      { id: "auto", label: "Auto (recommended)" },
      { id: "nemotron-3-120b", label: "Nemotron 3 120B" },
      { id: "dots3-note-preview", label: "Dots3 Note Preview" },
    ]);
  });

  it("exports endpointPaths with expected entries", () => {
    expect(endpointPaths).toEqual([
      { label: "Chat Completions (OpenAI)", value: "chat/completions" },
      { label: "Responses (OpenAI)", value: "responses" },
      { label: "Messages (Anthropic-compatible (Claude))", value: "messages" },
    ]);
  });

  it("exports agentConfigurationDoc as a non-empty string", () => {
    expect(typeof agentConfigurationDoc).toBe("string");
    expect(agentConfigurationDoc.length).toBeGreaterThan(0);
    expect(agentConfigurationDoc).toContain("custom agent configuration");
    expect(agentConfigurationDoc).toContain("apiKey");
    expect(agentConfigurationDoc).toContain("model");
    expect(agentConfigurationDoc).toContain("endpointPath");
    expect(agentConfigurationDoc).toContain("baseUrl");
    expect(agentConfigurationDoc).toContain("timeoutSec");
  });

  it("exports DEFAULT_BASE_URL as empty string by default", () => {
    expect(DEFAULT_BASE_URL).toBe("");
  });
});