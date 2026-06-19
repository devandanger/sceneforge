import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VideoContext } from "@sceneforge/schema";

export async function ensureVoiceover(context: VideoContext): Promise<string | undefined> {
  const voiceover = context.video.audio.voiceover;
  if (!voiceover) {
    return undefined;
  }

  if (process.env.SCENEFORGE_SKIP_TTS === "1") {
    return undefined;
  }

  if (voiceover.provider !== "elevenlabs") {
    throw new Error(`Unsupported TTS provider: ${voiceover.provider}`);
  }

  const voiceId = voiceover.voiceId === "default"
    ? process.env.ELEVENLABS_DEFAULT_VOICE_ID
    : voiceover.voiceId;

  if (!voiceId) {
    throw new Error("Missing voice id. Set ELEVENLABS_DEFAULT_VOICE_ID or provide audio.voiceover.voiceId.");
  }

  const key = hash(`${voiceId}:${voiceover.script}`);
  const outputPath = path.join(context.cacheDir, `voiceover-${key}.mp3`);
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY. Set it before running sceneforge tts, preview, or render with voiceover.");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      "accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text: voiceover.script,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${body}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}
