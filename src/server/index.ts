import type { ServerAdapterModule, AdapterSessionCodec, AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { type, models,endpointPaths, agentConfigurationDoc, DEFAULT_BASE_URL } from "../metadata.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

const sessionCodec: AdapterSessionCodec = {
  deserialize(_raw) {
    return null;
  },
  serialize(_params) {
    return null;
  },
  getDisplayId(_params) {
    return null;
  },
};


const modelsList = models.map((m) => {
  return {
    label: m.label,
    value: m.id,
  };
});

const endpointPathOption = endpointPaths.map(endpoint => {
  return {
    label: endpoint.label,
    value: endpoint.value
  }
})

const configSchema: AdapterConfigSchema = {
  fields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "text",
      required: true,
      hint: "Bearer token sent as Authorization: Bearer <apiKey>. Falls back to injected Paperclip auth token if omitted.",
    },
    {
      key: "model",
      label: "Model",
      type: "select",
      default: "auto",
      options: modelsList,
      hint: "Passed as the request's model field.",
    },
    {
      key: "endpointPath",
      label: "Endpoint",
      type: "select",
      default: "chat/completions",
      options: endpointPathOption,
      hint: "Which custom endpoint to call.",
    },
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      default: DEFAULT_BASE_URL || "https://api.openai.com/v1",
      hint: "Override for testing against a staging host.",
    },
    {
      key: "requestTimeoutMs",
      label: "Request Timeout (ms)",
      type: "number",
      default: 30000,
      hint: "Request timeout.",
    },
    {
      key: "promptTemplate",
      label: "Prompt Template(optional)",
      type: "textarea",
      hint: "Custom prompt template using {{variable}} syntax. Uses Paperclip's default agent prompt if omitted.",
    },
  ],
} satisfies AdapterConfigSchema;

// This is the entrypoint Paperclip's external-adapter loader calls
// (`createServerAdapter()` off the package's "." export). Returning the
// module from a factory — instead of exporting `execute`/`testEnvironment`/
// etc. directly — is what the host's plugin loader requires.
export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    models,
    agentConfigurationDoc,
    getConfigSchema: () => configSchema,
  };
}
