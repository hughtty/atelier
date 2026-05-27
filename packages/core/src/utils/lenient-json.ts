/**
 * Lenient JSON parser for LLM output. Strict JSON first; on failure, applies
 * progressively more aggressive recovery strategies:
 *   1. Strip markdown code fences (```json ... ```)
 *   2. Strip trailing commas (`,]` and `,}`)
 *   3. Brace-balanced truncation: find the last point where braces/brackets
 *      are balanced and try parsing that prefix
 *
 * Returns the parsed value. Throws with the original (most informative)
 * error if every strategy fails.
 */
export function parseLenientJson(raw: string): unknown {
  const trimmed = raw.trim();

  // 1. Strip code fences
  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const stripped = fenced?.[1]?.trim() ?? trimmed;

  // Slice from first { or [ to last matching brace
  const firstObj = stripped.indexOf("{");
  const firstArr = stripped.indexOf("[");
  const firstBrace = firstObj < 0
    ? firstArr
    : (firstArr < 0 ? firstObj : Math.min(firstObj, firstArr));
  if (firstBrace < 0) {
    throw new Error(`No JSON brace found in: ${raw.slice(0, 200)}`);
  }
  const body = stripped.slice(firstBrace);

  // Strategy 1: strict parse
  let firstError: unknown;
  try {
    return JSON.parse(body);
  } catch (err) {
    firstError = err;
  }

  // Strategy 2: strip trailing commas before } or ]
  const noTrailingCommas = body.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(noTrailingCommas);
  } catch {
    // continue
  }

  // Strategy 3: brace-balanced truncation
  const truncated = balancedTruncate(noTrailingCommas);
  if (truncated && truncated.length < noTrailingCommas.length) {
    try {
      return JSON.parse(truncated);
    } catch {
      // continue
    }
  }

  // Strategy 4: same balanced truncation but on the comma-stripped body
  // applied earlier — already done above, so re-raise with original info
  throw new Error(
    `Failed to parse JSON after lenient recovery. Original error: ${
      firstError instanceof Error ? firstError.message : String(firstError)
    }. Body head: ${body.slice(0, 200)}`,
  );
}

/**
 * Returns the longest prefix of `body` that ends on a balanced top-level
 * brace, or null if no such prefix exists.
 *
 * Walks character-by-character tracking depth + string state. Records the
 * index of every position where depth returns to 0; returns slice ending at
 * the last such index.
 */
function balancedTruncate(body: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastBalancedEnd = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        lastBalancedEnd = i;
      }
    }
  }
  if (lastBalancedEnd < 0) return null;
  return body.slice(0, lastBalancedEnd + 1);
}
