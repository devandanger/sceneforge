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

Text scenes support simple alignment and per-scene text colors:

```json
{
  "type": "text",
  "title": "One JSON file.",
  "subtitle": "A short vertical video.",
  "align": "center",
  "verticalAlign": "center",
  "titleColor": "#2B6FD9",
  "subtitleColor": "#6B7280"
}
```

`titleColor` and `subtitleColor` accept any CSS color (hex recommended) and
default to `theme.primaryTextColor` — handy for readable text on a `dark`
template (`template: "dark"` applies a dark gradient background).

For layered composition, use `overlays` on any scene. The generated schema is the
source of truth for all fields, but the core model is: scene content first,
then ordered overlays above it. A `group` overlay stacks child text/image
overlays vertically or horizontally without arbitrary CSS.

## ElevenLabs

Voiceover generation requires:

```sh
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=
```

Generated voiceovers are cached in the video's local `.cache/` directory.

For local renderer testing without TTS credentials:

```sh
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- preview ./examples/product-launch/video.json
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- render ./examples/product-launch/video.json
```

## JSON Schema

```sh
npm run sceneforge -- schema ./schema/sceneforge-video.schema.json
```

## Releasing

Releases are published to npm by CI, triggered by a version tag — you never run
`npm publish` (or deal with 2FA) locally. The `release.yml` workflow verifies the
tag matches `package.json`, runs the full gate (`prepublishOnly`: check → test →
check:package → build), then `npm publish --provenance`. The publish job runs in a
protected `release` environment, so the run **pauses for maintainer approval**
before it goes live.

```sh
git checkout main && git pull          # clean, up-to-date tree
# ...commit any code changes first (npm version requires a clean tree)...

npm version patch                      # bumps package.json, commits, tags vX.Y.Z
                                       # (use minor for new features, major for breaking changes)
git push --follow-tags                 # the tag push triggers the release workflow
```

Verify:

```sh
npm view sceneforge version
```

Notes:

- **Approve the release.** After the tag push, the run waits in the `release`
  environment — approve it in the Actions tab to publish.
- **Never publish by hand.** CI's `NPM_TOKEN` is an automation token that bypasses
  2FA; a manual `npm publish` hits the interactive 2FA wall.
- **If a release run fails, bump forward** (`npm version patch` again) rather than
  force-moving a tag — tags should stay immutable.
- **Version and tag must agree.** `npm version` keeps them in sync and the workflow
  guards against a mismatch.
- Requires an `NPM_TOKEN` repo secret (automation token, or a `sceneforge`-scoped
  granular token with 2FA bypass) and a public repo (for provenance).
- Optional: `gh release create vX.Y.Z --generate-notes` for human-readable notes.

## License

SceneForge is licensed under the [MIT License](./LICENSE).

**Note on rendering:** `render` and `preview` use [Remotion](https://www.remotion.dev),
which is source-available under its own license — not MIT. Remotion is free for
individuals and small companies, but **companies above its team-size threshold
need a paid [Remotion Company License](https://www.remotion.pro)**. This applies
to anyone rendering with SceneForge. See [`NOTICE.md`](./NOTICE.md) for full
third-party licensing details.
