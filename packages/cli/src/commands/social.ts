import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PipelineRunner,
  SocialTopologistAgent,
  readSocialTopology,
  readHistoricalContext,
  readThematicFramework,
  writeSocialTopology,
  writeHistoricalContext,
} from "@atelier/core";
import {
  loadConfig,
  buildPipelineConfig,
  findProjectRoot,
  resolveBookId,
  log,
  logError,
} from "../utils.js";

export const socialCommand = new Command("social")
  .description("Map social topology + historical context (social_topology.json + historical_context.json)")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .option("--brief <path>", "Path to author brief markdown (default: ./brief.md or book-id/brief.md)")
  .option("--setting <path>", "Optional: path to setting / world notes markdown")
  .option("--era <path>", "Optional: path to era / historical notes markdown")
  .option("--lang <language>", "zh (default) or en")
  .option("--json", "Output JSON to stdout instead of saving")
  .option("--no-save", "Run analysis without writing to disk")
  .action(async (bookIdArg: string | undefined, opts: { brief?: string; setting?: string; era?: string; lang?: string; json?: boolean; save?: boolean }) => {
    try {
      const config = await loadConfig();
      const root = findProjectRoot();
      const bookId = await resolveBookId(bookIdArg, root);

      const brief = await loadBrief(opts.brief, root, bookId);
      const settingNotes = opts.setting ? await readFile(resolve(opts.setting), "utf8") : undefined;
      const eraNotes = opts.era ? await readFile(resolve(opts.era), "utf8") : undefined;

      const pipeline = new PipelineRunner(buildPipelineConfig(config, root));
      const ctx = pipeline.buildAgentContext("social-topologist", bookId);
      const agent = new SocialTopologistAgent(ctx);

      const priorTopology = await readSocialTopology(root, bookId);
      const priorHistorical = await readHistoricalContext(root, bookId);
      const thematic = await readThematicFramework(root, bookId);

      if (!opts.json) {
        log(`Mapping social topology + historical context for "${bookId}"${priorTopology ? " (refining existing)" : ""}...`);
        if (!thematic) log("  Note: no thematic_framework.json found. Recommended to run `atelier theme` first.");
      }

      const result = await agent.map({
        brief,
        bookTitle: bookId,
        thematicFramework: thematic,
        settingNotes,
        eraNotes,
        priorTopology,
        priorHistorical,
        language: (opts.lang === "en" ? "en" : "zh"),
      });

      if (opts.json) {
        log(JSON.stringify({ topology: result.topology, historical: result.historical }, null, 2));
        return;
      }

      if (opts.save !== false) {
        const topologyPath = await writeSocialTopology(root, bookId, result.topology);
        const historicalPath = await writeHistoricalContext(root, bookId, result.historical);
        log(`Saved social_topology.json     → ${topologyPath}`);
        log(`Saved historical_context.json  → ${historicalPath}`);
      } else {
        log("(--no-save) Result not written; preview only:");
        log(JSON.stringify({ topology: result.topology, historical: result.historical }, null, 2));
      }
    } catch (e) {
      if (opts.json) log(JSON.stringify({ error: String(e) }));
      else logError(`Social topology mapping failed: ${e}`);
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
