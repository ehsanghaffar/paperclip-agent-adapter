import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_BASE_URL } from "../metadata.js";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const apiKeyEnv = asString(ctx.config.apiKeyEnv, "");
  const baseUrl = asString(ctx.config.baseUrl, DEFAULT_BASE_URL);

  if (!apiKeyEnv) {
    checks.push({
      code: "custom_missing_apiKeyEnv",
      level: "error",
      message: "No API key environment variable configured for the custom adapter.",
      hint: "Set config.apiKeyEnv, or confirm the injected Paperclip auth token is expected to authenticate to custom adapter.",
    });
  } else {
    checks.push({
      code: "custom_apiKey_present",
      level: "info",
      message: "API key is configured.",
    });
  }

  let validUrl = true;
  try {
    // eslint-disable-next-line no-new
    new URL(baseUrl);
  } catch {
    validUrl = false;
  }
  checks.push(
    validUrl
      ? { code: "custom_base_url_valid", level: "info", message: `Base URL: ${baseUrl}` }
      : {
          code: "custom_base_url_invalid",
          level: "error",
          message: `Invalid base URL: ${baseUrl}`,
          hint: "Expected an absolute URL like https://custom.com/v1",
        },
  );

  const status = checks.some((c) => c.level === "error")
    ? "fail"
    : checks.some((c) => c.level === "warn")
      ? "warn"
      : "pass";

  return {
    adapterType: "custom",
    status,
    checks,
    testedAt: new Date().toISOString(),
  };
}