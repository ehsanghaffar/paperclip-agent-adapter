import pc from "picocolors";

export function formatStdoutEvent(line: string, debug: boolean): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    if (debug) {
      console.log(pc.gray(`[stdout] ${line}`));
    }
    return;
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;

    if (obj.error) {
      const message =
        typeof obj.error === "string"
          ? obj.error
          : (obj.error as Record<string, unknown>)?.message ?? "unknown error";
      console.log(pc.red(`[custom provider error] ${message}`));
      return;
    }

    const text =
      (obj.choices && Array.isArray(obj.choices) && obj.choices[0] && typeof obj.choices[0] === "object" && obj.choices[0].message && typeof obj.choices[0].message === "object" && obj.choices[0].message.content) ||
      obj.output_text ||
      (Array.isArray(obj.content)
        ? (obj.content.find((c: unknown) => c && typeof c === "object" && (c as Record<string, unknown>).type === "text") as Record<string, unknown> | undefined)?.text
        : undefined);

    if (typeof text === "string" && text.length > 0) {
      console.log(pc.green(`[assistant] ${text}`));
      return;
    }

    if (obj.usage) {
      const usage = obj.usage as Record<string, unknown>;
      const input = usage.prompt_tokens ?? usage.input_tokens ?? 0;
      const output = usage.completion_tokens ?? usage.output_tokens ?? 0;
      console.log(pc.blue(`[usage] input: ${input}, output: ${output}`));
      return;
    }
  }

  if (debug) {
    console.log(pc.gray(`[stdout] ${line}`));
  }
}