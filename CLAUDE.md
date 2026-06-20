# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SceneForge is a local-first JSON video builder for repeatable branded short-form marketing videos. A single `video.json` file declares the video's format, theme, audio, and scenes; the toolchain validates it, optionally generates voiceover via ElevenLabs, and renders an MP4 with Remotion.

## Commands

```sh
npm install
npm run sceneforge -- validate <video.json>   # parse + report scenes/duration
npm run sceneforge -- preview  <video.json>    # open Remotion Studio
npm run sceneforge -- render   <video.json> [output.mp4]
npm run sceneforge -- tts      <video.json>    # generate voiceover only
npm run sceneforge -- schema   [out.schema.json]  # emit JSON Schema from Zod
npm run check                                   # tsc --noEmit (only typecheck/CI gate)
```

There is **no test runner and no linter** — `npm run check` (TypeScript `--noEmit`) is the only automated verification. The CLI runs via `tsx` directly against TypeScript source; nothing is compiled to `dist/`.

`validate`, `render`, and `tts` accept `--json` for agentic/scripted use: a single JSON object is written to stdout while all human logs and Remotion render output are routed to stderr (see the `info`/`emit`/`runRemotion` helpers in `apps/cli/src/index.ts`). Validation-error `path` fields are the dotted JSON path that failed. Keep this stdout-purity invariant when adding commands or log lines.

`examples/simple-no-ai/video.json` needs no AI credentials and is the fastest end-to-end smoke test of the renderer.

### Running without ElevenLabs credentials

```sh
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- preview ./examples/naprej-launch/video.json
```
Voiceover requires `ELEVENLABS_API_KEY` and `ELEVENLABS_DEFAULT_VOICE_ID` (the latter used when a scene's `voiceId` is `"default"`). Generated MP3s are cached in each project's `.cache/` directory, keyed by a hash of voiceId+script.

## Architecture

npm workspaces monorepo (`apps/*`, `packages/*`). All cross-package imports use TS path aliases (`@sceneforge/schema`, `@sceneforge/tts`, `@sceneforge/renderer`) defined in `tsconfig.base.json`; packages export raw `.ts`/`.tsx` source, never build artifacts.

The render pipeline is a one-way data flow, orchestrated by `apps/cli/src/index.ts`:

1. **`@sceneforge/schema`** (`loadAndResolveVideo`) — reads `video.json`, validates against the Zod `VideoSchema`, and resolves it into a `VideoContext`. Resolution computes each scene's `startSeconds` (cumulative cursor over `duration`) and resolves relative `image` paths to absolute paths, erroring on missing assets.
2. **`@sceneforge/tts`** (`ensureVoiceover`) — if `audio.voiceover` is present, calls ElevenLabs and returns a cached MP3 path. Returns `undefined` when no voiceover is configured or `SCENEFORGE_SKIP_TTS=1`.
3. **`@sceneforge/schema`** (`writeResolvedProps`) — serializes a `ResolvedRenderProps` to `.cache/render-props.json`. **Assets are inlined as base64 data URLs here** (`assetDataUrl`), so the renderer is self-contained and needs no filesystem access to project assets.
4. **`@sceneforge/renderer`** — the CLI shells out to `npx remotion` (`preview`/`render`) pointed at `packages/renderer/src/remotion-entry.tsx`, passing `--props .cache/render-props.json`. Composition id is `SceneForge`; `calculateMetadata` derives dimensions/fps/duration from props.

`packages/templates` is currently an empty placeholder package.

### Schema is the contract

`packages/schema/src/index.ts` is the single source of truth. Scenes are a Zod `discriminatedUnion` on `type`: `text`, `image`, `screenshot`, `cta`. To add a scene type or field, change the Zod schema **and** the matching render branch in `packages/renderer/src/video.tsx` (`Scene` does a `scene.type === ...` switch). The JSON Schema is generated from these Zod definitions via `exportVideoJsonSchema` — don't hand-edit schema JSON.

Note the schema imports `zod/v3` and uses `zod-to-json-schema` (jsonSchema7 target); keep new schema code on the v3 API surface.

**The generated schema is how agents discover capabilities — treat it as the runtime contract, not the docs.** Agentic workflows are expected to call `sceneforge schema` (and `validate --json`) to learn what's legal, then generate conforming JSON. A field only "exists" for an agent once it's in the Zod schema and therefore in the generated output. So, when adding capabilities:

- **Make every new field self-documenting with `.describe()`.** `zod-to-json-schema` propagates it into a JSON Schema `description`, so the schema carries semantics (what the field does, when to use it), not just shapes. A field without `.describe()` is invisible to an agent except as a bare type. Example: `align: z.enum(["left","center","right"]).default("left").describe("Horizontal text alignment within the brand frame.")`.
- **Keep additions backward-compatible.** Add fields as `.optional()` or with `.default(...)`, never repurpose an existing field. JSON authored against the old schema must stay valid — a new *required* field silently breaks every existing workflow.
- **Use `enum`s for choices, not free strings.** Enums are the surface agents read to learn allowed values (`transition`, `backgroundStyle`, `align`). Signal deprecation in the `.describe()` text rather than removing.
- **Don't duplicate the schema in prose.** README/CLAUDE.md should point at `sceneforge schema` for the field list, not maintain a hand-written copy that drifts.

### Rendering conventions (`packages/renderer/src/video.tsx`)

- Every scene is wrapped in a `BrandFrame` that applies padding, background style, and the optional top rule. Visual branching keys off the resolved `template` string (e.g. `template.toLowerCase().includes("blazebite")` switches background gradients) — `template` falls back to `theme.brand` when unset.
- Padding: explicit `format.padding` (px) wins; otherwise `paddingPercent` (default 8%) of the shorter side.
- Transitions are frame-interpolated opacity fades (plus optional `slide-up`); `transition: "none"` opts out.
- `fileUrl` passes through `http`/`file`/`data` URLs and prefixes bare paths with `file://`. Since props arrive as data URLs, the data-URL branch is the live path.
