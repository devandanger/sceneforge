import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// These exercise the real CLI contract that agentic workflows depend on: a single
// JSON object on stdout, human/Remotion noise on stderr, and meaningful exit codes.
// The CLI is spawned as a subprocess (not imported — index.ts runs main() on load).
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const cliEntry = path.join(here, "index.ts");
const example = path.join(repoRoot, "examples/simple-no-ai/video.json");
const pkgVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).version as string;

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function tmpVideo(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-cli-"));
  const file = path.join(dir, "video.json");
  fs.writeFileSync(file, content);
  return file;
}

test("validate --json emits one pure JSON object on stdout and exits 0", () => {
  const res = runCli(["validate", example, "--json"]);
  assert.equal(res.status, 0, res.stderr);
  // Stdout purity: exactly one line, and it parses.
  const lines = res.stdout.trim().split("\n");
  assert.equal(lines.length, 1);
  const out = JSON.parse(lines[0]);
  assert.equal(out.ok, true);
  assert.equal(out.command, "validate");
  assert.equal(out.scenes, 3);
  assert.equal(out.durationSeconds, 7);
});

test("validate --json reports field-addressable errors and exits 1 on invalid input", () => {
  const bad = tmpVideo("{}");
  const res = runCli(["validate", bad, "--json"]);
  assert.equal(res.status, 1);
  const out = JSON.parse(res.stdout.trim());
  assert.equal(out.ok, false);
  assert.ok(Array.isArray(out.errors) && out.errors.length > 0);
  assert.equal(typeof out.errors[0].path, "string");
  assert.equal(typeof out.errors[0].message, "string");
});

test("capabilities --json exposes commands, version, and agent-safety flags", () => {
  const res = runCli(["capabilities", "--json"]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout.trim());
  assert.equal(out.command, "capabilities");
  assert.equal(out.version, pkgVersion);

  const names = out.commands.map((c: { name: string }) => c.name);
  for (const expected of ["validate", "render", "preview", "tts", "schema", "capabilities"]) {
    assert.ok(names.includes(expected), `missing command in manifest: ${expected}`);
  }

  const preview = out.commands.find((c: { name: string }) => c.name === "preview");
  assert.equal(preview.agentSafe, false, "preview must be flagged not agent-safe");

  const render = out.commands.find((c: { name: string }) => c.name === "render");
  assert.ok(render.env.includes("SCENEFORGE_SKIP_TTS"));
});

test("schema --json is parseable and carries inline field descriptions", () => {
  const res = runCli(["schema", "--json"]);
  assert.equal(res.status, 0, res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.ok(JSON.stringify(parsed).includes("Horizontal text alignment within the brand frame."));
});
