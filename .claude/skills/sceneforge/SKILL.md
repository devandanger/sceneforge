---
name: sceneforge
description: >-
  Author, validate, and render branded short-form marketing videos with the
  SceneForge CLI from a single video.json (text/image/screenshot/cta/video
  scenes, overlays, ElevenLabs voiceover). Use when the user wants to create,
  edit, validate, preview, or render a SceneForge video, or generate voiceover.
when_to_use: >-
  The user asks to make/build/edit a branded vertical or short-form video, a
  TikTok/Reels/Shorts-style clip, a JSON-driven video, or mentions SceneForge or
  a video.json. Also when generating ElevenLabs voiceover for such a video.
---

# Driving SceneForge

SceneForge builds a video from one declarative `video.json`. Your job is to
produce a **schema-valid `video.json`** and drive the CLI. The tool is built to
be agent-discoverable — **learn the contract from the tool itself, never from
memory or these notes alone.**

## The command

- Installed (npm): `sceneforge <command> ...`
- Inside this repo (dev): `npm run sceneforge -- <command> ...`

Commands: `capabilities`, `schema`, `validate`, `preview`, `render`, `tts`.

## Procedure (do these in order)

1. **Discover commands.** Run `sceneforge capabilities` — a machine-readable
   manifest of every command, its flags, env vars, and which are `agentSafe`
   vs. interactive. Treat this as ground truth for what you can call.
2. **Discover the data contract.** Run `sceneforge schema` — the JSON Schema for
   `video.json`, generated from the source of truth. Every field is documented
   via its `description`. A field only "exists" if it's in this schema; do not
   invent fields. Use the `enum`s for allowed values (scene `type`, `transition`,
   `backgroundStyle`, `align`, `fit`, …).
3. **Author `video.json`** against that schema. See "Authoring rules" below.
4. **Validate** before rendering: `sceneforge validate <video.json> --json`.
   On failure, each issue's `path` is the dotted JSON path that failed — fix
   exactly that field and re-validate until `ok: true`.
5. **Render** (headless): `sceneforge render <video.json> [out.mp4] --json`.
   Output JSON reports `outputPath` and `durationSeconds`.
   - Set `SCENEFORGE_SKIP_TTS=1` to render without ElevenLabs credentials
     (voiceover is skipped).
6. **Preview** is `sceneforge preview <video.json>` — it opens interactive
   Remotion Studio and **blocks**. It is NOT agent-safe; only suggest it for a
   human to run, never call it in a headless/scripted flow.

## Iterating on the look — suggest `preview`

If the user is **repeatedly tweaking `video.json`** (lots of small visual
adjustments — colors, positions, durations, timing — followed by re-render
requests), stop re-running `render` for each change and **suggest they open
`sceneforge preview <video.json>`**. Why it's the better loop:

- Studio renders frames **instantly, with no MP4 encode**, so visual feedback is
  far faster than a full `render` per tweak.
- It's a live scrubbable timeline — they can jump to the exact scene/frame
  they're adjusting.

How to work it together (preview is interactive and blocking, so the **human**
runs it in their own terminal, not you):

1. Suggest they run `sceneforge preview <video.json>` and leave Studio open.
2. You keep editing `video.json` (and `validate --json` after each change).
3. The resolved props Studio reads are a snapshot written when `preview`
   launched, so after a batch of edits they **re-run `preview`** to regenerate
   them and see the changes. Keep edit batches small and tell them when it's a
   good moment to restart.
4. Only do a full `render` once the look is settled.

Surface this proactively the *second or third* time you're asked to re-render
after a small JSON edit — that's the signal a live preview loop will save time.

## The `--json` contract

`validate`, `render`, and `tts` accept `--json`: a single JSON object is written
to **stdout**, while all human logs and Remotion output go to **stderr**. When
scripting, read stdout as JSON; never assume logs are absent from stderr. Exit
code is non-zero on failure.

## Authoring rules

- **Every scene needs `type` and `duration`** (seconds). Total video length is
  the **sum** of all scene durations — there is no separate total field.
- **Scene types** are a discriminated union on `type`:
  `text` (title/subtitle), `image` (full-bleed + caption), `screenshot`
  (phone mockup), `cta` (call-to-action), `video` (full-bleed clip). Confirm
  each type's fields from `sceneforge schema`.
- **Overlays** (`overlays: [...]`) render above the scene; array order is the
  Z-stack. Overlay types: `text`, `image`, `video` (picture-in-picture),
  `group` (constrained vertical/horizontal stack of children).
- **Assets** (`image`, video `src`, overlay `src`, music `file`) are paths
  **relative to the `video.json` file**, or `http(s)` URLs. Missing local assets
  fail at load with a clear error.
- **Video clips** (`video` scene/overlay): the clip is **cut to the scene's
  `duration`**; `trimStart` offsets the in-point; a clip shorter than the scene
  freezes on its last frame (no looping yet). `muted` defaults to false (clip
  audio plays); set it true when a voiceover should dominate.
- **Keep layout percent-based and enum-driven** (e.g. `widthPercent`,
  `fontSizePercent`, `position`), not arbitrary CSS.
- Backward compatibility: prefer optional fields with sensible defaults; the
  schema's defaults apply when you omit a field.

## Voiceover (ElevenLabs)

- Add `audio.voiceover` with `provider: "elevenlabs"`, a `voiceId`, and a
  `script`. Optional `modelId` (e.g. `eleven_v3`), `languageCode` (e.g. `"sl"`),
  and `outputFormat` tune the call — check `sceneforge schema` for exact fields.
- Requires `ELEVENLABS_API_KEY`. A `voiceId` of `"default"` also needs
  `ELEVENLABS_DEFAULT_VOICE_ID`. Generate voiceover alone with
  `sceneforge tts <video.json> --json` (returns the cached MP3 path).
- No credentials? Run any command with `SCENEFORGE_SKIP_TTS=1` to skip TTS.

## Known-good seeds

Start from a working example and adapt rather than authoring blank:

- `examples/simple-no-ai/video.json` — text/image/cta, **no credentials needed**;
  the fastest end-to-end smoke test.
- `examples/video-clip/video.json` — a `video` scene plus a `video` overlay
  (picture-in-picture).

## Guardrails

- Never hand-edit or hand-author the schema JSON — it's generated; read it, don't
  write it.
- Don't break stdout purity in `--json` mode.
- Don't call `preview` in a headless/agent flow (it blocks on Studio).
