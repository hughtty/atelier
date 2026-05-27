/**
 * Atelier deprecation stub.
 *
 * Fanfic prompt sections are removed in Atelier's literary mode. These
 * functions return empty strings so callers (writer-prompts.ts) emit nothing
 * when a fanficContext happens to be passed in — no behavioral change for
 * literary projects, which never set fanficMode.
 */

import type { FanficMode } from "../models/book.js";

export function buildFanficCanonSection(_fanficCanon: string, _mode: FanficMode): string {
  return "";
}

export function buildCharacterVoiceProfiles(_fanficCanon: string): string {
  return "";
}

export function buildFanficModeInstructions(
  _mode: FanficMode,
  _allowedDeviations: ReadonlyArray<string>,
): string {
  return "";
}
