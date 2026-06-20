// Bundles the CLI for npm distribution. The dev setup runs TypeScript source
// through tsx with workspace path aliases; neither survives `npm publish`, so we:
//   1. Bundle apps/cli + the @sceneforge/* workspace packages into one dist/index.js
//      (npm deps stay external; only the workspace source is inlined).
//   2. Ship the renderer .tsx files next to it — Remotion bundles them itself at
//      render time, so they stay as source.
import esbuild from "esbuild";
import { cpSync, chmodSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

// Inline relative imports and the @sceneforge/* workspace packages; leave every
// other bare import (npm deps + node builtins) external so they resolve from the
// installed package's node_modules at runtime.
const externalizeDeps = {
  name: "externalize-deps",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") return undefined;
      const p = args.path;
      if (p.startsWith(".") || p.startsWith("/") || p.startsWith("@sceneforge/")) {
        return undefined; // bundle it
      }
      return { path: p, external: true };
    });
  }
};

await esbuild.build({
  entryPoints: ["apps/cli/src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  tsconfig: "tsconfig.base.json", // resolves the @sceneforge/* path aliases
  banner: { js: "#!/usr/bin/env node" },
  plugins: [externalizeDeps],
  logLevel: "info"
});

chmodSync("dist/index.js", 0o755);

// Renderer source ships as-is; getRendererEntry() points Remotion here at runtime.
mkdirSync("dist/renderer", { recursive: true });
cpSync("packages/renderer/src/remotion-entry.tsx", "dist/renderer/remotion-entry.tsx");
cpSync("packages/renderer/src/video.tsx", "dist/renderer/video.tsx");

console.log("Built dist/index.js + dist/renderer/");
