/**
 * Atelier deprecation stub.
 *
 * The radar / platform-ranking subsystem was removed during the InkOS →
 * Atelier refactor (Qidian / Fanqie / TextRadar are commercial-web-novel
 * platforms, not applicable to serious-literary writing). This file
 * preserves the symbol surface so deeper-pipeline imports still type-check.
 * None of these classes should be invoked at runtime in Atelier's literary
 * pipeline; they will throw if called.
 */

export interface RankingEntry {
  readonly title: string;
  readonly author: string;
  readonly category: string;
  readonly extra: string;
}

export interface PlatformRankings {
  readonly platform: string;
  readonly entries: ReadonlyArray<RankingEntry>;
}

export interface RadarSource {
  readonly id: string;
  fetch(): Promise<PlatformRankings>;
}

const NOT_SUPPORTED = "Platform-ranking sources are not supported in Atelier (literary mode).";

export class TextRadarSource implements RadarSource {
  readonly id = "text";
  async fetch(): Promise<PlatformRankings> {
    throw new Error(NOT_SUPPORTED);
  }
}

export class FanqieRadarSource implements RadarSource {
  readonly id = "fanqie";
  async fetch(): Promise<PlatformRankings> {
    throw new Error(NOT_SUPPORTED);
  }
}

export class QidianRadarSource implements RadarSource {
  readonly id = "qidian";
  async fetch(): Promise<PlatformRankings> {
    throw new Error(NOT_SUPPORTED);
  }
}
