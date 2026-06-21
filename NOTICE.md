# Third-party notices

SceneForge's own source code is licensed under the MIT License (see `LICENSE`).
It depends on third-party software with its own licenses. Most dependencies are
permissive (MIT/ISC). **One dependency is not open source and carries usage
obligations that pass through to you:**

## Remotion (rendering engine)

`render` and `preview` are powered by [Remotion](https://www.remotion.dev)
(`remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`), which
is **source-available, not open source**, and licensed under the Remotion
License — **not** under SceneForge's MIT license.

Remotion is free for individuals and small companies, but **companies above
Remotion's team-size threshold require a paid Remotion Company License**. This
obligation applies to anyone who uses SceneForge to render video, regardless of
SceneForge's MIT license.

- License terms: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- Company licenses: https://www.remotion.pro

SceneForge does not bundle or redistribute Remotion's source; Remotion is
installed as a normal npm dependency, and its license governs your use of it.

## Other dependencies

- react, react-dom, zod, esbuild, tsx — MIT
- zod-to-json-schema — ISC

## ElevenLabs (optional voiceover)

`tts` calls the ElevenLabs API with your own API key. Your use of that service
is governed by ElevenLabs' terms, not by this license.
