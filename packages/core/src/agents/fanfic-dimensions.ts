/**
 * Atelier deprecation stub.
 *
 * Fanfiction-specific audit dimensions are removed in Atelier's literary
 * mode. The exports remain so existing importers (continuity.ts) still
 * type-check; the configuration returned is empty / inert and will not
 * affect any audit run when fanficMode is not set.
 */

import type { FanficMode } from "../models/book.js";

export interface FanficDimensionConfig {
  readonly activeIds: ReadonlyArray<number>;
  readonly severityOverrides: ReadonlyMap<number, "critical" | "warning" | "info">;
  readonly deactivatedIds: ReadonlyArray<number>;
  readonly notes: ReadonlyMap<number, string>;
}

export const FANFIC_DIMENSIONS: ReadonlyArray<{
  readonly id: number;
  readonly name: string;
  readonly baseNote: string;
}> = [];

const EMPTY_CONFIG: FanficDimensionConfig = {
  activeIds: [],
  severityOverrides: new Map(),
  deactivatedIds: [],
  notes: new Map(),
};

export function getFanficDimensionConfig(
  _mode: FanficMode,
  _allowedDeviations: ReadonlyArray<string> = [],
): FanficDimensionConfig {
  return EMPTY_CONFIG;
}
