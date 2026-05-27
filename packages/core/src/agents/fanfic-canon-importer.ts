/**
 * Atelier deprecation stub.
 *
 * Fanfiction canon import is removed in Atelier's literary mode. This file
 * preserves the symbol surface so deep-pipeline importers still type-check.
 * Any call to importFromText() throws.
 */

import { BaseAgent } from "./base.js";

export interface FanficCanonOutput {
  readonly worldRules: string;
  readonly characterProfiles: string;
  readonly keyEvents: string;
  readonly powerSystem: string;
  readonly writingStyle: string;
  readonly fullDocument: string;
}

const NOT_SUPPORTED = "FanficCanonImporter is not supported in Atelier (literary mode).";

export class FanficCanonImporter extends BaseAgent {
  get name(): string {
    return "fanfic-canon-importer";
  }

  async importFromText(..._args: unknown[]): Promise<FanficCanonOutput> {
    throw new Error(NOT_SUPPORTED);
  }

  async importFromFile(..._args: unknown[]): Promise<FanficCanonOutput> {
    throw new Error(NOT_SUPPORTED);
  }
}
