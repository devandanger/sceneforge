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
  sceneforge validate <video.json>
  sceneforge preview <video.json>
  sceneforge render <video.json> [output.mp4]
  sceneforge tts <video.json>
  sceneforge schema [output.schema.json]
`;

async function main() {
  const [command, videoPath, outputPath] = process.argv.slice(2) as [Command | "--help" | "-h" | undefined, string | undefined, string | undefined];

  if (!command || command === "--help" || command === "-h") {
    console.log(usage);
    return;
  }

  if (command === "schema") {
    const schema = JSON.stringify(exportVideoJsonSchema(), null, 2);
    if (videoPath) {
      fs.writeFileSync(path.resolve(videoPath), `${schema}\n`);
      console.log(`Wrote JSON Schema to ${path.resolve(videoPath)}`);
    } else {
      console.log(schema);
    }
    return;
  }

  if (!videoPath) {
    throw new Error(`Missing video.json path.\n\n${usage}`);
  }

  const loaded = loadAndResolveVideo(videoPath);
  if (!loaded.ok) {
    printValidationErrors(loaded.error);
    process.exitCode = 1;
    return;
  }

  const context = loaded.value;

  if (command === "validate") {
    console.log(`Valid SceneForge video: ${context.videoPath}`);
    console.log(`Scenes: ${context.video.scenes.length}`);
    console.log(`Duration: ${context.totalDurationSeconds.toFixed(1)}s`);
    return;
  }

  if (command === "tts") {
    const audioPath = await ensureVoiceover(context);
    if (audioPath) {
      console.log(`Voiceover ready: ${audioPath}`);
    } else {
      console.log("No voiceover configured.");
    }
    return;
  }

  const voiceoverPath = await ensureVoiceover(context);
  const propsPath = writeResolvedProps(context, voiceoverPath);
  const rendererEntry = getRendererEntry();

  if (command === "preview") {
    runRemotion(["preview", rendererEntry, "--props", propsPath]);
    return;
  }

  if (command === "render") {
    const finalOutput = path.resolve(outputPath ?? path.join(context.projectDir, "output.mp4"));
    runRemotion(["render", rendererEntry, "SceneForge", finalOutput, "--props", propsPath]);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function getRendererEntry() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../packages/renderer/src/remotion-entry.tsx");
}

function runRemotion(args: string[]) {
  const result = spawnSync("npx", ["remotion", ...args], {
    stdio: "inherit",
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
