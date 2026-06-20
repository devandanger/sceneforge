import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VideoSchema,
  loadAndResolveVideo,
  writeResolvedProps,
  resolveExistingAsset,
  exportVideoJsonSchema
} from "./index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const simpleNoAi = path.join(repoRoot, "examples/simple-no-ai/video.json");

function tmpVideo(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-schema-"));
  const file = path.join(dir, "video.json");
  fs.writeFileSync(file, content);
  return file;
}

const minimalValid = {
  format: {},
  theme: { brand: "Acme" },
  scenes: [{ type: "text", duration: 1.5, title: "Hi" }]
};

test("VideoSchema applies documented defaults", () => {
  const v = VideoSchema.parse(minimalValid);
  assert.equal(v.version, "0.1");
  assert.equal(v.format.width, 1080);
  assert.equal(v.format.height, 1920);
  assert.equal(v.format.fps, 30);
  assert.equal(v.theme.layout.showBrandMark, true);
  assert.equal(v.theme.layout.backgroundStyle, "soft");
  const first = v.scenes[0];
  assert.equal(first.type, "text");
  if (first.type === "text") {
    assert.equal(first.align, "left");
    assert.equal(first.verticalAlign, "center");
  }
});

test("VideoSchema rejects a missing brand with a field-addressable path", () => {
  const res = VideoSchema.safeParse({ format: {}, scenes: minimalValid.scenes });
  assert.equal(res.success, false);
  if (!res.success) {
    assert.ok(res.error.issues.some((i) => i.path.join(".") === "theme"));
  }
});

test("VideoSchema rejects a non-hex color", () => {
  const res = VideoSchema.safeParse({
    ...minimalValid,
    theme: { brand: "Acme", backgroundColor: "red" }
  });
  assert.equal(res.success, false);
  if (!res.success) {
    assert.ok(res.error.issues.some((i) => i.path.join(".") === "theme.backgroundColor"));
  }
});

test("VideoSchema rejects an unknown scene type (discriminated union)", () => {
  const res = VideoSchema.safeParse({
    ...minimalValid,
    scenes: [{ type: "video", duration: 1 }]
  });
  assert.equal(res.success, false);
});

test("loadAndResolveVideo computes cumulative timing and resolves assets", () => {
  const res = loadAndResolveVideo(simpleNoAi);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const ctx = res.value;
  assert.equal(ctx.scenes.length, 3);
  assert.deepEqual(ctx.scenes.map((s) => s.startSeconds), [0, 2, 5]);
  assert.equal(ctx.totalDurationSeconds, 7);

  const imageScene = ctx.scenes[1];
  assert.equal(imageScene.type, "image");
  assert.ok(imageScene.imagePath && path.isAbsolute(imageScene.imagePath));
  assert.ok(fs.existsSync(imageScene.imagePath!));

  // A text scene carries no resolved asset path.
  assert.equal(ctx.scenes[0].imagePath, undefined);
});

test("loadAndResolveVideo returns ok:false (not throw) on schema errors", () => {
  const file = tmpVideo("{}");
  const res = loadAndResolveVideo(file);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(res.error.issues.length > 0);
  }
});

test("loadAndResolveVideo throws on a missing local asset", () => {
  const file = tmpVideo(
    JSON.stringify({
      format: {},
      theme: { brand: "X" },
      scenes: [{ type: "image", duration: 1, image: "./missing.svg" }]
    })
  );
  assert.throws(() => loadAndResolveVideo(file), /Missing local asset/);
});

test("writeResolvedProps inlines assets as base64 data URLs", () => {
  const res = loadAndResolveVideo(simpleNoAi);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const propsPath = writeResolvedProps(res.value);
  const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
  const imageScene = props.scenes[1];
  assert.match(imageScene.imagePath, /^data:image\/svg\+xml;base64,/);
  assert.equal(props.voiceoverPath, undefined);
  assert.equal(props.totalDurationSeconds, 7);
});

test("resolveExistingAsset returns absolute path or throws", () => {
  const projectDir = path.join(repoRoot, "examples/simple-no-ai");
  const resolved = resolveExistingAsset(projectDir, "./assets/brand-card.svg");
  assert.ok(path.isAbsolute(resolved) && fs.existsSync(resolved));
  assert.throws(() => resolveExistingAsset(projectDir, "./nope.svg"), /Missing local asset/);
});

test("exportVideoJsonSchema carries field descriptions for agent discovery", () => {
  const json = JSON.stringify(exportVideoJsonSchema());
  // Descriptions are the discovery surface; a known one must be present and inlined.
  assert.ok(json.includes("Horizontal text alignment within the brand frame."));
});
