import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { VideoContext } from "@sceneforge/schema";
import { ensureVoiceover } from "./index.ts";

const ENV_KEYS = ["SCENEFORGE_SKIP_TTS", "ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE_ID"] as const;

// ensureVoiceover only reads context.video.audio.voiceover and context.cacheDir,
// so a minimal fake context is enough and keeps these tests off the filesystem
// fixtures (and the network).
function makeContext(voiceover: unknown): VideoContext {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-tts-"));
  return { cacheDir, video: { audio: { voiceover } } } as unknown as VideoContext;
}

// Run with a clean, explicit env baseline so tests don't leak into each other or
// depend on the developer's real ElevenLabs credentials.
async function withEnv<T>(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  }
}

test("returns undefined when no voiceover is configured", async () => {
  const result = await withEnv({}, () => ensureVoiceover(makeContext(undefined)));
  assert.equal(result, undefined);
});

test("returns undefined when SCENEFORGE_SKIP_TTS=1", async () => {
  const voiceover = { provider: "elevenlabs", voiceId: "v1", script: "hello" };
  const result = await withEnv({ SCENEFORGE_SKIP_TTS: "1" }, () => ensureVoiceover(makeContext(voiceover)));
  assert.equal(result, undefined);
});

test("throws on an unsupported provider", async () => {
  const voiceover = { provider: "made-up", voiceId: "v1", script: "hello" };
  await withEnv({}, () =>
    assert.rejects(() => ensureVoiceover(makeContext(voiceover)), /Unsupported TTS provider/)
  );
});

test("throws when voiceId is \"default\" but no default voice env is set", async () => {
  const voiceover = { provider: "elevenlabs", voiceId: "default", script: "hello" };
  await withEnv({}, () =>
    assert.rejects(() => ensureVoiceover(makeContext(voiceover)), /Missing voice id/)
  );
});

test("throws a clear error when the API key is missing and nothing is cached", async () => {
  const voiceover = { provider: "elevenlabs", voiceId: "voiceX", script: "uncached script" };
  await withEnv({}, () =>
    assert.rejects(() => ensureVoiceover(makeContext(voiceover)), /Missing ELEVENLABS_API_KEY/)
  );
});

test("returns the cached file without hitting the network", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-tts-cache-"));
  // modelId/outputFormat carry their schema defaults; languageCode is unset.
  const voiceover = {
    provider: "elevenlabs",
    voiceId: "voiceX",
    script: "cached script",
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  };
  const ctx = { cacheDir, video: { audio: { voiceover } } } as unknown as VideoContext;

  // Mirror the cache key the implementation derives:
  // sha256(voiceId:modelId:languageCode:outputFormat:script), 12 hex chars.
  const key = crypto
    .createHash("sha256")
    .update("voiceX:eleven_multilingual_v2::mp3_44100_128:cached script")
    .digest("hex")
    .slice(0, 12);
  const cachedPath = path.join(cacheDir, `voiceover-${key}.mp3`);
  fs.writeFileSync(cachedPath, "fake-audio");

  // No API key set: a cache hit must short-circuit before any fetch.
  const result = await withEnv({}, () => ensureVoiceover(ctx));
  assert.equal(result, cachedPath);
});
