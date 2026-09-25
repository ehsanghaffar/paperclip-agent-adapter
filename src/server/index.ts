import type { ServerAdapterModule, AdapterSessionCodec } from "@paperclipai/adapter-utils";
import { type, models, agentConfigurationDoc } from "../metadata.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

import { getConfigSchema } from "./schema.js";

export { getConfigSchema } from "./schema.js";

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

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    models,
    agentConfigurationDoc,
    getConfigSchema,
  };
}
