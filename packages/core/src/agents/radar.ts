/**
 * Atelier deprecation stub.
 *
 * RadarAgent (commercial platform-ranking analysis) is removed in Atelier's
 * literary mode. This file preserves the symbol surface for any internal
 * importer that has not yet been deep-cleaned. Calling .scan() throws.
 */

import { BaseAgent } from "./base.js";
import type { Platform, Genre } from "../models/book.js";
import type { RadarSource } from "./radar-source.js";

export interface RadarResult {
  readonly recommendations: ReadonlyArray<RadarRecommendation>;
  readonly marketSummary: string;
  readonly timestamp: string;
}

export interface RadarRecommendation {
  readonly platform: Platform;
  readonly genre: Genre;
  readonly concept: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly benchmarkTitles: ReadonlyArray<string>;
}

const NOT_SUPPORTED = "RadarAgent is not supported in Atelier (literary mode).";

export class RadarAgent extends BaseAgent {
  constructor(
    ctx: ConstructorParameters<typeof BaseAgent>[0],
    _sources?: ReadonlyArray<RadarSource>,
  ) {
    super(ctx);
  }

  get name(): string {
    return "radar";
  }

  async scan(): Promise<RadarResult> {
    throw new Error(NOT_SUPPORTED);
  }

  async analyze(): Promise<RadarResult> {
    throw new Error(NOT_SUPPORTED);
  }
}
