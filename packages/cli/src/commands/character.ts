import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PipelineRunner,
  CharacterPsychologistAgent,
  readCharacterPsychology,
  readThematicFramework,
  writeCharacterPsychology,
} from "@atelier/core";
import {
  loadConfig,
  buildPipelineConfig,
  findProjectRoot,
  resolveBookId,
  log,
  logError,
} from "../utils.js";

export const characterCommand = new Command("character")
  .description("Build or refine the character-psychology depth map (character_psychology.json)")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .option("--brief <path>", "Path to author brief markdown (default: ./brief.md or book-id/brief.md)")
  .option("--lang <language>", "zh (default) or en")
  .option("--json", "Output JSON to stdout instead of saving")
  .option("--no-save", "Run analysis without writing to disk")
  .action(async (bookIdArg: string | undefined, opts: { brief?: string; lang?: string; json?: boolean; save?: boolean }) => {
    try {
      const config = await loadConfig();
      const root = findProjectRoot();
      const bookId = await resolveBookId(bookIdArg, root);

      const brief = await loadBrief(opts.brief, root, bookId);

      const pipeline = new PipelineRunner(buildPipelineConfig(config, root));
      const ctx = pipeline.buildAgentContext("character-psychologist", bookId);
      const agent = new CharacterPsychologistAgent(ctx);

      const priorPsychology = await readCharacterPsychology(root, bookId);
      const thematic = await readThematicFramework(root, bookId);

      if (!opts.json) {
        log(`Building character-psychology depth map for "${bookId}"${priorPsychology ? " (refining existing)" : ""}...`);
        if (!thematic) log("  Note: no thematic_framework.json found. Recommended to run `atelier theme` first for stronger character-theme alignment.");
      }

      const result = await agent.analyze({
        brief,
        bookTitle: bookId,
        thematicFramework: thematic,
        priorPsychology,
        language: (opts.lang === "en" ? "en" : "zh"),
      });

      if (opts.json) {
        log(JSON.stringify(result.psychology, null, 2));
        return;
      }

      if (opts.save !== false) {
        const path = await writeCharacterPsychology(root, bookId, result.psychology);
        log(`Saved character_psychology.json → ${path}`);
        log(`  ${result.psychology.characters.length} character(s) modeled`);
      } else {
        log("(--no-save) Result not written; preview only:");
        log(JSON.stringify(result.psychology, null, 2));
      }
    } catch (e) {
      if (opts.json) log(JSON.stringify({ error: String(e) }));
      else logError(`Character psychology analysis failed: ${e}`);
      process.exit(1);
    }
  });

async function loadBrief(briefPath: string | undefined, root: string, bookId: string): Promise<string> {
  const candidates = briefPath
    ? [resolve(briefPath)]
    : [
        resolve(root, "books", bookId, "brief.md"),
        resolve(root, "brief.md"),
      ];
  for (const p of candidates) {
    try {
      return await readFile(p, "utf8");
    } catch {
      // try next
    }
  }
  throw new Error(
    `Brief not found. Looked at: ${candidates.join(", ")}. ` +
    "Provide one with --brief <path> or place a brief.md in the project / book directory.",
  );
}
