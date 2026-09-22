export { type, label, models, agentConfigurationDoc } from "./metadata.js";

// The host calls createServerAdapter() from the package root's "." export.
// This is the required entrypoint per Paperclip's external-adapter contract —
// exporting the pieces individually (execute, testEnvironment, ...) without
// this factory is what produces "Package does not export createServerAdapter()".
export { createServerAdapter } from "./server/index.js";
