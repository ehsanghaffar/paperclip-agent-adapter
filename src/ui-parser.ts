// Self-contained UI parser for the your adapter, per Paperclip's
// Adapter UI Parser Contract:
//   - no runtime imports, no DOM access, no Node APIs
//   - no top-level side effects
//   - deterministic output for the same (line, ts)
//   - never throw — fall back to a plain "stdout" entry
//
// execute.ts logs the raw your API response body as a single onLog("stdout", ...)
// chunk, so each "line" this parser sees is typically one full JSON response.
// A local type is used instead of an import so the module stays import-free.

type TranscriptEntry =
  | { kind: "assistant"; ts: string; text: string; delta?: boolean }
  | { kind: "thinking"; ts: string; text: string; delta?: boolean }
  | { kind: "user"; ts: string; text: string }
  | { kind: "tool_call"; ts: string; name: string; input: unknown; toolUseId?: string }
  | { kind: "tool_result"; ts: string; toolUseId: string; content: string; isError: boolean }
  | { kind: "system"; ts: string; text: string }
  | { kind: "stderr"; ts: string; text: string }
  | { kind: "stdout"; ts: string; text: string };

export function parseStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  let json: any;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return [{ kind: "stdout", ts, text: line }];
  }

  if (json && typeof json === "object") {
    if (json.error) {
      const message =
        typeof json.error === "string"
          ? json.error
          : (json.error && json.error.message) || "unknown error";
      return [{ kind: "system", ts, text: `custom provider error: ${message}` }];
    }

    const text =
      (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
      json.output_text ||
      (Array.isArray(json.content)
        ? (json.content.find((c: any) => c && c.type === "text") || {}).text
        : undefined);

    if (typeof text === "string" && text.length > 0) {
      return [{ kind: "assistant", ts, text }];
    }
  }

  // No confirmed tool-call/function-calling shape for api responses — if
  // that turns out to exist, add tool_call/tool_result branches above.
  return [{ kind: "stdout", ts, text: line }];
}
