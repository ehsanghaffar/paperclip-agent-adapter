import { describe, it, expect, vi } from "vitest";
import { testEnvironment } from "../../src/server/test.js";
import type { AdapterEnvironmentTestContext } from "@paperclipai/adapter-utils";

describe("testEnvironment", () => {
  const createMockContext = (overrides: Partial<AdapterEnvironmentTestContext> = {}): AdapterEnvironmentTestContext => ({
    companyId: "company-1",
    adapterType: "custom",
    config: {
      apiKey: "test-api-key",
      baseUrl: "https://api.example.com/v1",
    },
    ...overrides,
  });

  it("passes when apiKey and baseUrl are valid", async () => {
    const ctx = createMockContext();
    const result = await testEnvironment(ctx);

    expect(result.status).toBe("pass");
    expect(result.adapterType).toBe("custom");
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].code).toBe("custom_apiKey_present");
    expect(result.checks[0].level).toBe("info");
    expect(result.checks[1].code).toBe("custom_base_url_valid");
    expect(result.checks[1].level).toBe("info");
  });

  it("fails when apiKey is missing", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, apiKey: "" },
    });
    const result = await testEnvironment(ctx);

    expect(result.status).toBe("fail");
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].code).toBe("custom_missing_apiKey");
    expect(result.checks[0].level).toBe("error");
    expect(result.checks[0].message).toContain("No API key configured");
    expect(result.checks[1].code).toBe("custom_base_url_valid");
  });

  it("fails when baseUrl is invalid", async () => {
    const ctx = createMockContext({
      config: { ...createMockContext().config, baseUrl: "not-a-valid-url" },
    });
    const result = await testEnvironment(ctx);

    expect(result.status).toBe("fail");
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].code).toBe("custom_apiKey_present");
    expect(result.checks[1].code).toBe("custom_base_url_invalid");
    expect(result.checks[1].level).toBe("error");
    expect(result.checks[1].message).toContain("Invalid base URL");
  });

  it("fails when both apiKey missing and baseUrl invalid", async () => {
    const ctx = createMockContext({
      config: { apiKey: "", baseUrl: "invalid" },
    });
    const result = await testEnvironment(ctx);

    expect(result.status).toBe("fail");
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].code).toBe("custom_missing_apiKey");
    expect(result.checks[0].level).toBe("error");
    expect(result.checks[1].code).toBe("custom_base_url_invalid");
    expect(result.checks[1].level).toBe("error");
  });

  it("includes testedAt timestamp", async () => {
    const ctx = createMockContext();
    const result = await testEnvironment(ctx);

    expect(result.testedAt).toBeDefined();
    expect(new Date(result.testedAt).toISOString()).toBe(result.testedAt);
  });
});