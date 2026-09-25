
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
      (json.choices && json.choices[0] && json.choices[0].text) ||
      json.output_text ||
      (Array.isArray(json.output)
        ? json.output
            .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
            .filter((c: any) => c?.type === "output_text" || c?.type === "text")
            .map((c: any) => c?.text)
            .filter((t: unknown) => typeof t === "string")
            .join("")
        : undefined) ||
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
