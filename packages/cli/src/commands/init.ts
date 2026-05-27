import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { log, logError } from "../utils.js";
import { initializeProjectDirectory } from "../project-bootstrap.js";

export const initCommand = new Command("init")
  .description("Initialize an Atelier project (current directory by default)")
  .argument("[name]", "Project name (creates subdirectory). Omit to init current directory.")
  .option("--lang <language>", "Default writing language: zh (Chinese, default) or en (English)", "zh")
  .action(async (name: string | undefined, opts: { lang?: string }) => {
    const projectDir = name ? resolve(process.cwd(), name) : process.cwd();

    try {
      await mkdir(projectDir, { recursive: true });
      await initializeProjectDirectory(projectDir, {
        language: (opts.lang === "en" ? "en" : "zh"),
        overwriteSupportFiles: true,
      });

      log(`Project initialized at ${projectDir}`);
      log("");
      const isEnglish = (opts.lang ?? "zh") === "en";
      const exampleCreate = isEnglish
        ? "  atelier book create --title 'My Novel' --genre social-realism --lang en"
        : "  atelier book create --title '我的小说' --genre social-realism";
      if (global) {
        log("Global LLM config detected. Ready to go!");
        log("");
        log("Next steps:");
        if (name) log(`  cd ${name}`);
        log(exampleCreate);
      } else {
        log("Next steps:");
        if (name) log(`  cd ${name}`);
        log("  # Option 1: Set global config (recommended, one-time):");
        log("  atelier config set-global --provider openai --base-url <your-api-url> --api-key <your-key> --model <your-model>");
        log("  # Option 2: Edit .env for this project only");
        log("");
        log(exampleCreate);
      }
      log("  atelier write next <book-id>");
    } catch (e) {
      logError(`Failed to initialize project: ${e}`);
      process.exit(1);
    }
  });
