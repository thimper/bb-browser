interface ParseSuccess<T> {
  ok: true;
  value: T;
}

interface ParseFailure {
  ok: false;
  error: Error;
}

function tryParseJson<T>(raw: string): ParseSuccess<T> | ParseFailure {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function extractTopLevelJson(raw: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1);
      }
      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

export function parseOpenClawJson<T>(raw: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OpenClaw returned empty output");
  }

  const direct = tryParseJson<T>(trimmed);
  if (direct.ok) {
    return direct.value;
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== "{" && char !== "[") {
      continue;
    }

    const candidate = extractTopLevelJson(trimmed, index);
    if (!candidate) {
      continue;
    }

    const parsed = tryParseJson<T>(candidate);
    if (parsed.ok) {
      return parsed.value;
    }
  }

  throw new Error(`Failed to parse OpenClaw JSON output: ${direct.error.message}`);
}
