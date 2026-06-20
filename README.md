# SceneForge

SceneForge is a local-first JSON video builder for repeatable branded short-form marketing videos.

## Install

```sh
npm install -g sceneforge      # or run ad hoc: npx sceneforge <command>
sceneforge validate ./video.json
sceneforge render ./video.json out.mp4
```

Requires Node 18+. `render`/`preview` use Remotion, which downloads a headless
Chromium on first run. Voiceover (`tts`) needs ElevenLabs credentials (see below).

## Commands (from a clone)

```sh
npm install
npm run sceneforge -- validate ./examples/simple-no-ai/video.json
npm run sceneforge -- preview ./examples/simple-no-ai/video.json
npm run sceneforge -- render ./examples/simple-no-ai/video.json
```

## Agentic / scripted use (`--json`)

`validate`, `render`, and `tts` accept `--json`, which emits a single
machine-readable object to stdout and routes all human-readable logs (and
Remotion's render output) to stderr, so stdout stays parseable:

```sh
sceneforge validate ./video.json --json
# {"ok":true,"command":"validate","videoPath":"…","scenes":3,"durationSeconds":7}

sceneforge validate ./video.json --json   # on invalid input, exit code 1:
# {"ok":false,"command":"validate","errors":[{"path":"theme.brand","message":"Required"}]}

sceneforge render ./video.json out.mp4 --json
# {"ok":true,"command":"render","outputPath":"/abs/out.mp4","durationSeconds":7}
```

Error `path` values match the JSON field that failed validation, so a generating
agent can correct the exact field and retry. Commands exit non-zero on failure.
Use `render` (not the interactive `preview`) in headless/agent contexts, and pair
with `SCENEFORGE_SKIP_TTS=1` to render without TTS credentials.

### Discovering capabilities

A workflow can bootstrap the entire tool from two commands, with no static docs:

```sh
sceneforge capabilities --json   # commands, flags, env, and which are agent-safe
sceneforge schema --json         # the video.json data contract, every field documented
```

`capabilities` reports each command's flags, required env vars, and an `agentSafe`
flag (false for the interactive `preview`). `schema` is generated from the Zod
definitions, so new scene types and fields appear automatically — each carries a
`description`, enforced by `npm run check`.

## No-AI Example

`examples/simple-no-ai/video.json` has no voiceover, music generation, or external AI dependency. It only uses local JSON and `assets/brand-card.svg`, so it is the fastest smoke test for the renderer.

The example also shows how to hide renderer chrome:

```json
"layout": {
  "showBrandMark": false,
  "showTopRule": false,
  "backgroundStyle": "flat"
}
```

It also sets `"format.paddingPercent": 8`, matching the default padding of 8% of the shorter video side.

Text scenes support simple alignment:

```json
{
  "type": "text",
  "title": "One JSON file.",
  "subtitle": "A short vertical video.",
  "align": "center",
  "verticalAlign": "center"
}
```

## ElevenLabs

Voiceover generation requires:

```sh
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=
```

Generated voiceovers are cached in the video's local `.cache/` directory.

For local renderer testing without TTS credentials:

```sh
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- preview ./examples/naprej-launch/video.json
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- render ./examples/naprej-launch/video.json
```

## JSON Schema

```sh
npm run sceneforge -- schema ./schema/sceneforge-video.schema.json
```
