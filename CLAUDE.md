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
npm run sceneforge -- schema   [out.schema.json]  # emit JSON Schema from Zod (data contract)
npm run sceneforge -- capabilities                # machine-readable command/flag/env manifest
npm run check                                   # tsc --noEmit + schema description gate
npm test                                        # node:test suites (via tsx)
npm run build                                   # bundle the CLI to dist/ for npm publish
```

Verification is `npm run check` + `npm test`; there is **no linter**. `check` runs `tsc --noEmit` then `check:schema` (`scripts/check-schema-descriptions.ts`), which fails if any field in the generated JSON Schema lacks a `.describe()`. `npm test` runs Node's built-in `node:test` through `tsx` over `**/*.test.ts` (no extra test framework). Tests are co-located as `*.test.ts` next to source and are typechecked by `tsc`. The CLI runs via `tsx` directly against TypeScript source; nothing is compiled to `dist/`.

Test coverage by layer: `packages/schema` — defaults, validation errors, cumulative scene timing, asset resolution, base64 prop inlining; `packages/tts` — `ensureVoiceover` branch behavior (skip/cache/error paths) using fake contexts, no network; `apps/cli` — the `--json` contract (stdout purity, exit codes, structured errors, capabilities manifest) by spawning the CLI as a subprocess. Renders are not covered automatically (slow; they shell out to Remotion) — smoke-test with `SCENEFORGE_SKIP_TTS=1 … render` on `examples/simple-no-ai`.

`validate`, `render`, and `tts` accept `--json` for agentic/scripted use: a single JSON object is written to stdout while all human logs and Remotion render output are routed to stderr (see the `info`/`emit`/`runRemotion` helpers in `apps/cli/src/index.ts`). Validation-error `path` fields are the dotted JSON path that failed. Keep this stdout-purity invariant when adding commands or log lines.

**Capability discovery for agents.** Two commands let a workflow bootstrap the whole tool from `--json` output alone, with no static docs: `capabilities` describes the *commands* (flags, env vars, which are `agentSafe` vs. interactive), and `schema` describes the *data* (every field, self-documented). When you add a command or flag, update the `COMMANDS`/`ENV_VARS` manifest in `apps/cli/src/index.ts` so `capabilities` stays accurate; when you add a schema field, the CI gate forces a `.describe()`.

### Distribution (npm CLI)

The published artifact is the root package (`sceneforge`); `bin` → `dist/index.js`, `files` ships only `dist/`, and `prepublishOnly` runs check + test + build. `npm run build` (`scripts/build.mjs`, esbuild) bundles `apps/cli` **and inlines the `@sceneforge/*` workspace packages** into one `dist/index.js` — npm deps and node builtins stay external (only `zod`/`zod-to-json-schema` end up imported). The workspace packages themselves stay `private` and are never published; they exist only as source the bundle absorbs. The renderer is **not** bundled — its `.tsx` is copied to `dist/renderer/` and Remotion bundles it itself at render time (its only runtime imports are `react` + `remotion`; the `@sceneforge/schema` import is type-only and erased).

**Dual-layout gotcha:** the CLI runs from two directory depths — `apps/cli/src/index.ts` (dev, via tsx) and `dist/index.js` (installed). Any path derived from `import.meta.url` must handle both: `getRendererEntry` probes the bundled `./renderer` first then falls back to the monorepo path, `resolveRemotionBin` resolves `@remotion/cli` via `createRequire` (never `npx`/PATH), and `readCliVersion` walks up looking for the package named `sceneforge` (a fixed `../../../package.json` would read the *consumer's* manifest once installed). Verify packaging changes with `npm pack` + install into a temp dir outside the repo, not just in-repo.

### Release & CI hardening (intentional — don't weaken)

Publishing is automated and deliberately locked down. Several of these look like cleanup targets but are not:

- **GitHub Actions are pinned to commit SHAs** in `.github/workflows/*.yml` (with a `# v5` comment). Do **not** revert them to `@v5` tags — the pin stops a hijacked action tag from running inside the publish job that holds `NPM_TOKEN`. Dependabot (`.github/dependabot.yml`, `github-actions` ecosystem) bumps the SHAs via PRs; the repo also restricts allowed actions to GitHub-owned + verified.
- **`release.yml` runs in the `release` GitHub Environment**, which has a required reviewer — publishes pause for manual approval. CI (`ci.yml`) uses least-privilege `permissions: contents: read`.
- **`main` and `v*` tags are protected by rulesets** (no force-push, no deletion/rewrite). This is *why* a failed release bumps forward (`npm version patch`) instead of moving a tag.
- **Provenance requires `repository.url` in `package.json` and a public repo** — don't drop the `repository` field (a missing one fails publish with E422).
- **`NPM_TOKEN`** must allow non-interactive publish: an automation token, or a `sceneforge`-scoped granular token with 2FA bypass. A plain publish/granular token without bypass fails with E403; a token that can't create the package fails with E404.

Vulnerability reporting and supported-version policy live in `SECURITY.md` (GitHub private vulnerability reporting is enabled).

`examples/simple-no-ai/video.json` needs no AI credentials and is the fastest end-to-end smoke test of the renderer.

### Running without ElevenLabs credentials

```sh
SCENEFORGE_SKIP_TTS=1 npm run sceneforge -- preview ./examples/product-launch/video.json
```
Voiceover requires `ELEVENLABS_API_KEY` and `ELEVENLABS_DEFAULT_VOICE_ID` (the latter used when a scene's `voiceId` is `"default"`). Generated MP3s are cached in each project's `.cache/` directory, keyed by a hash of voiceId+script.

## Architecture

npm workspaces monorepo (`apps/*`, `packages/*`). All cross-package imports use TS path aliases (`@sceneforge/schema`, `@sceneforge/tts`, `@sceneforge/renderer`) defined in `tsconfig.base.json`; packages export raw `.ts`/`.tsx` source, never build artifacts.

The render pipeline is a one-way data flow, orchestrated by `apps/cli/src/index.ts`:

1. **`@sceneforge/schema`** (`loadAndResolveVideo`) — reads `video.json`, validates against the Zod `VideoSchema`, and resolves it into a `VideoContext`. Resolution computes each scene's `startSeconds` (cumulative cursor over `duration`) and resolves relative `image` paths to absolute paths, erroring on missing assets.
2. **`@sceneforge/tts`** (`ensureVoiceover`) — if `audio.voiceover` is present, calls ElevenLabs and returns a cached MP3 path. Returns `undefined` when no voiceover is configured or `SCENEFORGE_SKIP_TTS=1`.
3. **`@sceneforge/schema`** (`writeResolvedProps`) — serializes a `ResolvedRenderProps` to `.cache/render-props.json`. **Image/audio assets are inlined as base64 data URLs here** (`assetDataUrl`), so the renderer needs no filesystem access to them. **Video clips are the exception**: `OffthreadVideo` reads a real file/URL via ffmpeg and can't use a data URL, so local clips are *copied* into a served public dir (`stageVideoAsset` → `.cache/public/<hash>.<ext>`, keyed by path+size+mtime) and referenced by `staticFile(name)`; `http(s)` srcs pass through. The CLI passes `--public-dir` (`publicDirFor`) to both `preview` and `render` so the clip loads in Studio (over http) and at render time — a plain `file://` path would 404 in the browser.
4. **`@sceneforge/renderer`** — the CLI shells out to `npx remotion` (`preview`/`render`) pointed at `packages/renderer/src/remotion-entry.tsx`, passing `--props .cache/render-props.json`. Composition id is `SceneForge`; `calculateMetadata` derives dimensions/fps/duration from props.

`packages/templates` is currently an empty placeholder package.

### Schema is the contract

`packages/schema/src/index.ts` is the single source of truth. Scenes are a Zod `discriminatedUnion` on `type`: `text`, `image`, `screenshot`, `cta`, `video`. To add a scene type or field, change the Zod schema **and** the matching render branch in `packages/renderer/src/video.tsx` (`Scene` does a `scene.type === ...` switch). Overlays are likewise a discriminated union (`text`, `image`, `video`, `group`); a `video` overlay is the picture-in-picture form of a clip. The JSON Schema is generated from these Zod definitions via `exportVideoJsonSchema` — don't hand-edit schema JSON.

Note the schema imports `zod/v3` and uses `zod-to-json-schema` (jsonSchema7 target); keep new schema code on the v3 API surface.

**The generated schema is how agents discover capabilities — treat it as the runtime contract, not the docs.** Agentic workflows are expected to call `sceneforge schema` (and `validate --json`) to learn what's legal, then generate conforming JSON. A field only "exists" for an agent once it's in the Zod schema and therefore in the generated output. So, when adding capabilities:

- **Make every new field self-documenting with `.describe()`.** `zod-to-json-schema` propagates it into a JSON Schema `description`, so the schema carries semantics (what the field does, when to use it), not just shapes. A field without `.describe()` is invisible to an agent except as a bare type. Example: `align: z.enum(["left","center","right"]).default("left").describe("Horizontal text alignment within the brand frame.")`.
- **Keep additions backward-compatible.** Add fields as `.optional()` or with `.default(...)`, never repurpose an existing field. JSON authored against the old schema must stay valid — a new *required* field silently breaks every existing workflow.
- **Use `enum`s for choices, not free strings.** Enums are the surface agents read to learn allowed values (`transition`, `backgroundStyle`, `align`). Signal deprecation in the `.describe()` text rather than removing.
- **Don't duplicate the schema in prose.** README/CLAUDE.md should point at `sceneforge schema` for the field list, not maintain a hand-written copy that drifts.

### Rendering conventions (`packages/renderer/src/video.tsx`)

- Every scene is wrapped in a `BrandFrame` that applies padding, background style, and the optional top rule. Visual branching keys off the resolved `template` string (the enum is `light`/`dark`; `template.toLowerCase() === "dark"` switches to the dark gradient background) — `template` falls back to `theme.brand` when unset.
- Padding: explicit `format.padding` (px) wins; otherwise `paddingPercent` (default 8%) of the shorter side.
- Transitions are frame-interpolated opacity fades (plus optional `slide-up`); `transition: "none"` opts out.
- Scene `overlays` render after the base scene content, so array order behaves like a Z-stack. `group` overlays provide constrained vertical/horizontal stacking for child text/image overlays; keep layout fields percent-based and enum-driven, not arbitrary CSS.
- `fileUrl` passes through `http`/`file`/`data` URLs and prefixes bare paths with `file://`. Since props arrive as data URLs, the data-URL branch is the live path.
