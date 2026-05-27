import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PipelineRunner,
  SymbolWeaverAgent,
  readSymbolicNetwork,
  readThematicFramework,
  writeSymbolicNetwork,
} from "@atelier/core";
import {
  loadConfig,
  buildPipelineConfig,
  findProjectRoot,
  resolveBookId,
  log,
  logError,
} from "../utils.js";

export const symbolCommand = new Command("symbol")
  .description("Weave or refine the symbolic-network truth file (symbolic_network.json)")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .option("--brief <path>", "Path to author brief markdown (default: ./brief.md or book-id/brief.md)")
  .option("--setting <path>", "Optional: path to setting / world notes markdown")
  .option("--lang <language>", "zh (default) or en")
  .option("--json", "Output JSON to stdout instead of saving")
  .option("--no-save", "Run analysis without writing to disk")
  .action(async (bookIdArg: string | undefined, opts: { brief?: string; setting?: string; lang?: string; json?: boolean; save?: boolean }) => {
    try {
      const config = await loadConfig();
      const root = findProjectRoot();
      const bookId = await resolveBookId(bookIdArg, root);

      const brief = await loadBrief(opts.brief, root, bookId);
      const settingNotes = opts.setting ? await readFile(resolve(opts.setting), "utf8") : undefined;

      const pipeline = new PipelineRunner(buildPipelineConfig(config, root));
      const ctx = pipeline.buildAgentContext("symbol-weaver", bookId);
      const agent = new SymbolWeaverAgent(ctx);

      const prior = await readSymbolicNetwork(root, bookId);
      const thematic = await readThematicFramework(root, bookId);

      if (!opts.json) {
        log(`Weaving symbolic network for "${bookId}"${prior ? " (refining existing)" : ""}...`);
        if (!thematic) log("  Note: no thematic_framework.json found. Recommended to run `atelier theme` first.");
      }

      const result = await agent.weave({
        brief,
        bookTitle: bookId,
        thematicFramework: thematic,
        settingNotes,
        priorNetwork: prior,
        language: (opts.lang === "en" ? "en" : "zh"),
      });

      if (opts.json) {
        log(JSON.stringify(result.network, null, 2));
        return;
      }

      if (opts.save !== false) {
        const path = await writeSymbolicNetwork(root, bookId, result.network);
        log(`Saved symbolic_network.json → ${path}`);
        log(`  ${result.network.core_images.length} core image(s) seeded`);
      } else {
        log("(--no-save) Result not written; preview only:");
        log(JSON.stringify(result.network, null, 2));
      }
    } catch (e) {
      if (opts.json) log(JSON.stringify({ error: String(e) }));
      else logError(`Symbol weaving failed: ${e}`);
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
