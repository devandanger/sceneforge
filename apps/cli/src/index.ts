import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportVideoJsonSchema,
  loadAndResolveVideo,
  printValidationErrors,
  writeResolvedProps
} from "@sceneforge/schema";
import { ensureVoiceover } from "@sceneforge/tts";

type Command = "validate" | "preview" | "render" | "tts" | "schema";

const usage = `SceneForge

Usage:
  sceneforge validate <video.json> [--json]
  sceneforge preview <video.json>
  sceneforge render <video.json> [output.mp4] [--json]
  sceneforge tts <video.json> [--json]
  sceneforge schema [output.schema.json] [--json]

Flags:
  --json   Emit a single machine-readable JSON object to stdout. Human-readable
           logs (and Remotion output) are routed to stderr so stdout stays pure.
`;

// Parse --json once at module scope so the top-level error handler can honor it.
const jsonMode = process.argv.includes("--json");

// In --json mode, human-readable status goes to stderr; stdout is reserved for
// the single JSON payload. In human mode it behaves like a normal console.log.
function info(message: string) {
  if (jsonMode) {
    process.stderr.write(`${message}\n`);
  } else {
    console.log(message);
  }
}

function emit(payload: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main() {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--") && arg !== "-h");
  const [command, videoPath, outputPath] = positional as [Command | undefined, string | undefined, string | undefined];
  const wantsHelp = !command || process.argv.includes("--help") || process.argv.includes("-h");

  if (wantsHelp) {
    info(usage);
    return;
  }

  if (command === "schema") {
    const schema = JSON.stringify(exportVideoJsonSchema(), null, 2);
    if (videoPath) {
      const resolved = path.resolve(videoPath);
      fs.writeFileSync(resolved, `${schema}\n`);
      if (jsonMode) {
        emit({ ok: true, command: "schema", outputPath: resolved });
      } else {
        info(`Wrote JSON Schema to ${resolved}`);
      }
    } else {
      // The schema itself is machine-readable, so print it to stdout in both modes.
      console.log(schema);
    }
    return;
  }

  if (!videoPath) {
    return fail(command, `Missing video.json path.\n\n${usage}`);
  }

  const loaded = loadAndResolveVideo(videoPath);
  if (!loaded.ok) {
    if (jsonMode) {
      emit({
        ok: false,
        command,
        errors: loaded.error.issues.map((issue) => ({
          path: issue.path.join(".") || "video",
          message: issue.message
        }))
      });
    } else {
      printValidationErrors(loaded.error);
    }
    process.exitCode = 1;
    return;
  }

  const context = loaded.value;

  if (command === "validate") {
    if (jsonMode) {
      emit({
        ok: true,
        command: "validate",
        videoPath: context.videoPath,
        scenes: context.video.scenes.length,
        durationSeconds: context.totalDurationSeconds
      });
    } else {
      info(`Valid SceneForge video: ${context.videoPath}`);
      info(`Scenes: ${context.video.scenes.length}`);
      info(`Duration: ${context.totalDurationSeconds.toFixed(1)}s`);
    }
    return;
  }

  if (command === "tts") {
    const audioPath = await ensureVoiceover(context);
    if (jsonMode) {
      emit({ ok: true, command: "tts", voiceoverPath: audioPath ?? null });
    } else if (audioPath) {
      info(`Voiceover ready: ${audioPath}`);
    } else {
      info("No voiceover configured.");
    }
    return;
  }

  const voiceoverPath = await ensureVoiceover(context);
  const propsPath = writeResolvedProps(context, voiceoverPath);
  const rendererEntry = getRendererEntry();

  if (command === "preview") {
    // Interactive Remotion Studio; not intended for agentic/headless use.
    runRemotion(["preview", rendererEntry, "--props", propsPath]);
    return;
  }

  if (command === "render") {
    const finalOutput = path.resolve(outputPath ?? path.join(context.projectDir, "output.mp4"));
    const ok = runRemotion(["render", rendererEntry, "SceneForge", finalOutput, "--props", propsPath]);
    if (jsonMode) {
      emit(
        ok
          ? { ok: true, command: "render", outputPath: finalOutput, durationSeconds: context.totalDurationSeconds }
          : { ok: false, command: "render", error: "Remotion render failed.", outputPath: finalOutput }
      );
    } else if (ok) {
      info(`Rendered video: ${finalOutput}`);
    }
    return;
  }

  return fail(command, `Unknown command: ${command}`);
}

function fail(command: string | undefined, message: string) {
  if (jsonMode) {
    emit({ ok: false, command: command ?? null, error: message });
  } else {
    console.error(message);
  }
  process.exitCode = 1;
}

function getRendererEntry() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../packages/renderer/src/remotion-entry.tsx");
}

// Returns true when Remotion exited cleanly. In --json mode the child's stdout is
// redirected to our stderr so the only thing on stdout is the final JSON payload.
function runRemotion(args: string[]): boolean {
  const result = spawnSync("npx", ["remotion", ...args], {
    stdio: jsonMode ? ["inherit", process.stderr, "inherit"] : "inherit",
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonMode) {
    emit({ ok: false, error: message });
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
