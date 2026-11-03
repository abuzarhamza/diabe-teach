import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import escomplex from "escomplex";
import ts from "typescript";

export interface ComplexityMetrics {
  readonly file: string;
  readonly maintainability: number;
  readonly cyclomaticMean: number;
  readonly cyclomaticTotal: number;
  readonly physicalSloc: number;
  readonly logicalSloc: number;
  readonly halstead: {
    readonly difficulty: number;
    readonly effort: number;
    readonly volume: number;
    readonly bugs: number;
    readonly timeSeconds: number;
  };
  readonly functionCount: number;
}

export class ComplexityAnalyzer {
  public static analyzeFile(filePath: string): ComplexityMetrics {
    const absolutePath = resolve(process.cwd(), filePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath} (${absolutePath})`);
    }

    const sourceCode = readFileSync(absolutePath, "utf8");
    const transpiledJs = ts.transpileModule(sourceCode, {
      compilerOptions: {
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;

    const analysis = escomplex.analyse(transpiledJs);

    return {
      file: filePath,
      maintainability: Math.round(analysis.maintainability * 100) / 100,
      cyclomaticMean: Math.round(analysis.cyclomatic * 100) / 100,
      cyclomaticTotal: analysis.aggregate.cyclomatic,
      physicalSloc: analysis.aggregate.sloc.physical,
      logicalSloc: analysis.aggregate.sloc.logical,
      halstead: {
        difficulty:
          Math.round(analysis.aggregate.halstead.difficulty * 100) / 100,
        effort: Math.round(analysis.aggregate.halstead.effort),
        volume: Math.round(analysis.aggregate.halstead.volume * 100) / 100,
        bugs: Math.round(analysis.aggregate.halstead.bugs * 100) / 100,
        timeSeconds: Math.round(analysis.aggregate.halstead.time),
      },
      functionCount: analysis.functions.length,
    };
  }

  public static formatReport(metrics: ComplexityMetrics): string {
    const divider = "=".repeat(78);
    const timeHours = (metrics.halstead.timeSeconds / 3600).toFixed(1);

    return [
      divider,
      `Complexity Report: ${metrics.file}`,
      divider,
      `  Maintainability Index: ${metrics.maintainability} / 171 (Higher is better, >100 is high)`,
      `  Cyclomatic Complexity:`,
      `    - Mean per function: ${metrics.cyclomaticMean}`,
      `    - Aggregate total:   ${metrics.cyclomaticTotal}`,
      `  Lines of Code:`,
      `    - Physical SLOC:     ${metrics.physicalSloc}`,
      `    - Logical SLOC:      ${metrics.logicalSloc}`,
      `  Halstead Metrics:`,
      `    - Difficulty:        ${metrics.halstead.difficulty}`,
      `    - Effort:            ${metrics.halstead.effort.toLocaleString()}`,
      `    - Volume:            ${metrics.halstead.volume.toLocaleString()}`,
      `    - Estimated Bugs:    ${metrics.halstead.bugs}`,
      `    - Development Time:  ~${timeHours} hours (${metrics.halstead.timeSeconds}s)`,
      `  Functions Analyzed:    ${metrics.functionCount}`,
      divider,
    ].join("\n");
  }
}

export function runCli(argv = process.argv.slice(2)): void {
  const isJson = argv.includes("--json") || argv.includes("-j");
  const fileArgs = argv.filter(arg => !arg.startsWith("-"));

  const targetFiles
    = fileArgs.length > 0
      ? fileArgs
      : ["src/adapters/outbound/hmac-capability-token-adapter.ts"];

  const results: ComplexityMetrics[] = [];

  for (const file of targetFiles) {
    try {
      const metrics = ComplexityAnalyzer.analyzeFile(file);
      results.push(metrics);
      if (!isJson) {
        console.log(ComplexityAnalyzer.formatReport(metrics));
      }
    }
    catch (error) {
      console.error(
        `[Error] Failed to analyze ${file}:`,
        error instanceof Error
          ? error.message
          : error,
      );
      process.exitCode = 1;
    }
  }

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
