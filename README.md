# SceneForge

SceneForge is a local-first JSON video builder for repeatable branded short-form marketing videos.

## Commands

```sh
npm install
npm run sceneforge -- validate ./examples/simple-no-ai/video.json
npm run sceneforge -- preview ./examples/simple-no-ai/video.json
npm run sceneforge -- render ./examples/simple-no-ai/video.json
```

After `npm install`, the local binary also works:

```sh
sceneforge validate ./examples/simple-no-ai/video.json
sceneforge preview ./examples/simple-no-ai/video.json
sceneforge render ./examples/simple-no-ai/video.json
sceneforge tts ./examples/naprej-launch/video.json
```

## No-AI Example

`examples/simple-no-ai/video.json` has no voiceover, music generation, or external AI dependency. It only uses local JSON and `assets/brand-card.svg`, so it is the fastest smoke test for the renderer.

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
