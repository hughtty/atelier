import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "dotenv";

// Atelier prefers ~/.atelier/, falls back to ~/.inkos/ for backward compat.
export const GLOBAL_CONFIG_DIR = join(homedir(), ".atelier");
export const GLOBAL_ENV_PATH = join(GLOBAL_CONFIG_DIR, ".env");
const LEGACY_GLOBAL_CONFIG_DIR = join(homedir(), ".inkos");
const LEGACY_GLOBAL_ENV_PATH = join(LEGACY_GLOBAL_CONFIG_DIR, ".env");

// Atelier env-var aliases. ATELIER_* takes precedence; INKOS_* preserved for
// migration. Internal code reads INKOS_* keys, so aliasMap copies values
// from ATELIER_* into INKOS_* when only the new name is present.
const VAR_ALIASES: Readonly<Record<string, string>> = {
  ATELIER_LLM_PROVIDER: "INKOS_LLM_PROVIDER",
  ATELIER_LLM_SERVICE: "INKOS_LLM_SERVICE",
  ATELIER_LLM_BASE_URL: "INKOS_LLM_BASE_URL",
  ATELIER_LLM_API_KEY: "INKOS_LLM_API_KEY",
  ATELIER_LLM_MODEL: "INKOS_LLM_MODEL",
  ATELIER_LLM_API_FORMAT: "INKOS_LLM_API_FORMAT",
  ATELIER_LLM_STREAM: "INKOS_LLM_STREAM",
};

function applyAtelierAliases(map: LLMEnvMap): LLMEnvMap {
  const out: LLMEnvMap = { ...map };
  for (const [src, dst] of Object.entries(VAR_ALIASES)) {
    if (out[src] !== undefined && out[dst] === undefined) {
      out[dst] = out[src];
    }
  }
  return out;
}

export type LLMEnvMap = Record<string, string | undefined>;

export interface LLMEnvLayers {
  readonly global: LLMEnvMap;
  readonly project: LLMEnvMap;
  readonly process: LLMEnvMap;
}

export async function loadLLMEnvLayers(
  root: string,
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<LLMEnvLayers> {
  // Read ~/.atelier/.env first; if absent, fall back to ~/.inkos/.env
  let globalRaw = await parseEnvFile(GLOBAL_ENV_PATH);
  if (Object.keys(globalRaw).length === 0) {
    globalRaw = await parseEnvFile(LEGACY_GLOBAL_ENV_PATH);
  }
  const global = applyAtelierAliases(globalRaw);
  const project = applyAtelierAliases(await parseEnvFile(join(root, ".env")));
  // Compatibility: modelOverrides.apiKeyEnv and detector config still read process.env directly.
  hydrateProcessEnvFromEnvFiles(processEnv, global, project);

  return {
    global,
    project,
    process: applyAtelierAliases({ ...processEnv } as LLMEnvMap),
  };
}

export function mergeEnvMaps(...layers: readonly LLMEnvMap[]): LLMEnvMap {
  const merged: LLMEnvMap = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged;
}

export function studioIgnoredEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

export function cliOverlayEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

export function legacyEnv(layers: LLMEnvLayers): LLMEnvMap {
  return mergeEnvMaps(layers.global, layers.project, layers.process);
}

async function parseEnvFile(path: string): Promise<LLMEnvMap> {
  try {
    return parse(await readFile(path, "utf-8"));
  } catch {
    return {};
  }
}

function hydrateProcessEnvFromEnvFiles(
  processEnv: NodeJS.ProcessEnv,
  global: LLMEnvMap,
  project: LLMEnvMap,
): void {
  const fileEnv = mergeEnvMaps(global, project);
  for (const [key, value] of Object.entries(fileEnv)) {
    if (value !== undefined && processEnv[key] === undefined) {
      processEnv[key] = value;
    }
  }
}
