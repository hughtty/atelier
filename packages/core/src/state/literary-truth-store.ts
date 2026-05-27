/**
 * Storage helpers for the 6 Atelier literary truth files. JSON is
 * authoritative; markdown projection is optional and human-only.
 *
 * Storage layout:
 *   <projectRoot>/books/<bookId>/story/state/<file>.json
 *   <projectRoot>/books/<bookId>/story/<file>.md   (optional projection)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ZodSchema } from "zod";
import {
  ThematicFrameworkSchema,
  CharacterPsychologySchema,
  SymbolicNetworkSchema,
  SocialTopologySchema,
  NarrativeRhythmSchema,
  HistoricalContextSchema,
  LITERARY_TRUTH_FILES,
  type LiteraryTruthFileKey,
  type ThematicFramework,
  type CharacterPsychology,
  type SymbolicNetwork,
  type SocialTopology,
  type NarrativeRhythm,
  type HistoricalContext,
} from "../models/literary-truth-files.js";

const SCHEMAS: Record<LiteraryTruthFileKey, ZodSchema<unknown>> = {
  thematic_framework: ThematicFrameworkSchema,
  character_psychology: CharacterPsychologySchema,
  symbolic_network: SymbolicNetworkSchema,
  social_topology: SocialTopologySchema,
  narrative_rhythm: NarrativeRhythmSchema,
  historical_context: HistoricalContextSchema,
};

export function literaryTruthFilePath(
  projectRoot: string,
  bookId: string,
  key: LiteraryTruthFileKey,
): string {
  return join(projectRoot, "books", bookId, "story", "state", LITERARY_TRUTH_FILES[key]);
}

export async function readLiteraryTruthFile<T>(
  projectRoot: string,
  bookId: string,
  key: LiteraryTruthFileKey,
): Promise<T | null> {
  const path = literaryTruthFilePath(projectRoot, bookId, key);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const parsed = SCHEMAS[key].parse(JSON.parse(raw));
  return parsed as T;
}

export async function writeLiteraryTruthFile(
  projectRoot: string,
  bookId: string,
  key: LiteraryTruthFileKey,
  value: unknown,
): Promise<string> {
  const validated = SCHEMAS[key].parse(value);
  const path = literaryTruthFilePath(projectRoot, bookId, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(validated, null, 2) + "\n", "utf8");
  return path;
}

// Typed convenience wrappers
export const readThematicFramework = (root: string, bookId: string) =>
  readLiteraryTruthFile<ThematicFramework>(root, bookId, "thematic_framework");
export const readCharacterPsychology = (root: string, bookId: string) =>
  readLiteraryTruthFile<CharacterPsychology>(root, bookId, "character_psychology");
export const readSymbolicNetwork = (root: string, bookId: string) =>
  readLiteraryTruthFile<SymbolicNetwork>(root, bookId, "symbolic_network");
export const readSocialTopology = (root: string, bookId: string) =>
  readLiteraryTruthFile<SocialTopology>(root, bookId, "social_topology");
export const readNarrativeRhythm = (root: string, bookId: string) =>
  readLiteraryTruthFile<NarrativeRhythm>(root, bookId, "narrative_rhythm");
export const readHistoricalContext = (root: string, bookId: string) =>
  readLiteraryTruthFile<HistoricalContext>(root, bookId, "historical_context");

export const writeThematicFramework = (root: string, bookId: string, value: ThematicFramework) =>
  writeLiteraryTruthFile(root, bookId, "thematic_framework", value);
export const writeCharacterPsychology = (root: string, bookId: string, value: CharacterPsychology) =>
  writeLiteraryTruthFile(root, bookId, "character_psychology", value);
export const writeSymbolicNetwork = (root: string, bookId: string, value: SymbolicNetwork) =>
  writeLiteraryTruthFile(root, bookId, "symbolic_network", value);
export const writeSocialTopology = (root: string, bookId: string, value: SocialTopology) =>
  writeLiteraryTruthFile(root, bookId, "social_topology", value);
export const writeNarrativeRhythm = (root: string, bookId: string, value: NarrativeRhythm) =>
  writeLiteraryTruthFile(root, bookId, "narrative_rhythm", value);
export const writeHistoricalContext = (root: string, bookId: string, value: HistoricalContext) =>
  writeLiteraryTruthFile(root, bookId, "historical_context", value);
