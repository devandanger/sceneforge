import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportVideoJsonSchema,
  loadAndResolveVideo,
  printValidationErrors,
  writeResolvedProps
} from "@sceneforge/schema";
import { ensureVoiceover } from "@sceneforge/tts";

type Command = "validate" | "preview" | "render" | "tts" | "schema" | "capabilities";

const usage = `SceneForge

Usage:
  sceneforge validate <video.json> [--json]
  sceneforge preview <video.json>
  sceneforge render <video.json> [output.mp4] [--json]
  sceneforge tts <video.json> [--json]
  sceneforge schema [output.schema.json] [--json]
  sceneforge capabilities [--json]

Flags:
  --json   Emit a single machine-readable JSON object to stdout. Human-readable
           logs (and Remotion output) are routed to stderr so stdout stays pure.
`;

// Self-describing capability manifest. Agentic workflows call this to discover
// commands, flags, env, and the schema command without parsing --help. Keep it in
// sync when adding commands/flags; the data schema is discovered separately via
// `sceneforge schema`.
const ENV_VARS = [
  { name: "ELEVENLABS_API_KEY", required: "for voiceover", description: "ElevenLabs API key; required when audio.voiceover is set and TTS is not skipped." },
  { name: "ELEVENLABS_DEFAULT_VOICE_ID", required: "when voiceId is \"default\"", description: "Voice id used when a voiceover's voiceId is \"default\"." },
  { name: "SCENEFORGE_SKIP_TTS", required: "optional", description: "Set to \"1\" to skip voiceover generation (headless/credential-free renders)." }
];

const COMMANDS = [
  { name: "validate", args: ["<video.json>"], flags: ["--json"], interactive: false, agentSafe: true, env: [] as string[], summary: "Parse and validate a video.json; reports scene count and duration." },
  { name: "render", args: ["<video.json>", "[output.mp4]"], flags: ["--json"], interactive: false, agentSafe: true, env: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "SCENEFORGE_SKIP_TTS"], summary: "Render the video to an MP4 via Remotion; --json reports outputPath." },
  { name: "preview", args: ["<video.json>"], flags: [], interactive: true, agentSafe: false, env: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "SCENEFORGE_SKIP_TTS"], summary: "Open interactive Remotion Studio. Blocking; not for headless/agent use." },
  { name: "tts", args: ["<video.json>"], flags: ["--json"], interactive: false, agentSafe: true, env: ["ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID", "SCENEFORGE_SKIP_TTS"], summary: "Generate (and cache) the ElevenLabs voiceover only." },
  { name: "schema", args: ["[output.schema.json]"], flags: ["--json"], interactive: false, agentSafe: true, env: [] as string[], summary: "Emit the JSON Schema for video.json (the data contract). Writes to stdout, or to a file when a path is given." },
  { name: "capabilities", args: [], flags: ["--json"], interactive: false, agentSafe: true, env: [] as string[], summary: "Emit this machine-readable manifest of commands, flags, and env." }
];

function buildCapabilities() {
  return {
    ok: true,
    command: "capabilities",
    version: readCliVersion(),
    jsonStdoutContract: "With --json, validate/render/tts/capabilities print exactly one JSON object to stdout; all human logs and Remotion output go to stderr.",
    schemaCommand: "sceneforge schema --json",
    commands: COMMANDS,
    env: ENV_VARS
  };
}

// Find SceneForge's own package.json by walking up from this file. The directory
// depth differs between the bundled npm layout (dist/index.js) and the dev source
// tree (apps/cli/src), so match on name rather than a fixed relative path — a fixed
// path would otherwise read the *consumer's* package.json once installed.
function readCliVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as { name?: string; version?: string };
      if (pkg.name === "sceneforge") {
        return pkg.version ?? "0.0.0";
      }
    } catch {
      // no package.json here; keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "0.0.0";
}

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

  if (command === "capabilities") {
    const caps = buildCapabilities();
    if (jsonMode) {
      emit(caps);
    } else {
      // The manifest is machine-oriented; pretty-print to stdout in human mode.
      console.log(JSON.stringify(caps, null, 2));
    }
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

// Locate the Remotion entry in both layouts: bundled next to dist/index.js when
// installed from npm, or in the monorepo's packages/renderer during development.
function getRendererEntry() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.resolve(here, "./renderer/remotion-entry.tsx");
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  return path.resolve(here, "../../../packages/renderer/src/remotion-entry.tsx");
}

// Resolve the Remotion CLI from our own dependencies rather than relying on `npx`
// or PATH, so render/preview work whether installed globally, via npx, or in-repo.
function resolveRemotionBin(): string {
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve("@remotion/cli/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as { bin: string | Record<string, string> };
  const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.remotion;
  return path.resolve(path.dirname(pkgJsonPath), binRel);
}

// Returns true when Remotion exited cleanly. In --json mode the child's stdout is
// redirected to our stderr so the only thing on stdout is the final JSON payload.
function runRemotion(args: string[]): boolean {
  const result = spawnSync(process.execPath, [resolveRemotionBin(), ...args], {
    stdio: jsonMode ? ["inherit", process.stderr, "inherit"] : "inherit",
    cwd: process.cwd()
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
