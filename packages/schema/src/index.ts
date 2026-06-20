import fs from "node:fs";
import path from "node:path";
import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color.");

const BaseScene = z.object({
  id: z.string().min(1).optional(),
  duration: z.number().positive(),
  transition: z.enum(["none", "fade", "slide-up"]).optional()
});

const TextScene = BaseScene.extend({
  type: z.literal("text"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  align: z.enum(["left", "center", "right"]).default("left"),
  verticalAlign: z.enum(["top", "center", "bottom"]).default("center")
});

const ImageScene = BaseScene.extend({
  type: z.literal("image"),
  image: z.string().min(1),
  caption: z.string().optional()
});

const ScreenshotScene = BaseScene.extend({
  type: z.literal("screenshot"),
  image: z.string().min(1),
  title: z.string().optional()
});

const CtaScene = BaseScene.extend({
  type: z.literal("cta"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  cta: z.string().optional()
});

export const SceneSchema = z.discriminatedUnion("type", [
  TextScene,
  ImageScene,
  ScreenshotScene,
  CtaScene
]);

export const VideoSchema = z.object({
  version: z.string().default("0.1"),
  template: z.enum(["naprej", "blazebite"]).optional(),
  format: z.object({
    platform: z.string().default("tiktok"),
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1920),
    fps: z.number().int().positive().default(30),
    paddingPercent: z.number().min(0).max(25).optional(),
    padding: z.number().int().nonnegative().optional()
  }),
  theme: z.object({
    brand: z.string().min(1),
    backgroundColor: HexColor.default("#F7F2E8"),
    primaryTextColor: HexColor.default("#1E1E1E"),
    accentColor: HexColor.default("#D9482B"),
    fontFamily: z.string().default("Inter"),
    layout: z.object({
      showBrandMark: z.boolean().default(true),
      brandMarkText: z.string().optional(),
      showTopRule: z.boolean().default(true),
      backgroundStyle: z.enum(["flat", "soft", "bold"]).default("soft")
    }).default({})
  }),
  audio: z.object({
    voiceover: z.object({
      provider: z.literal("elevenlabs"),
      voiceId: z.string().default("default"),
      script: z.string().min(1)
    }).optional(),
    music: z.object({
      mode: z.enum(["none", "file"]).default("none"),
      file: z.string().optional(),
      volume: z.number().min(0).max(1).default(0.18)
    }).optional(),
    captions: z.object({
      mode: z.enum(["none", "scene"]).default("scene")
    }).optional()
  }).default({}),
  scenes: z.array(SceneSchema).min(1)
});

export type Video = z.infer<typeof VideoSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export type ResolvedScene = Scene & {
  imagePath?: string;
  startSeconds: number;
};

export type VideoContext = {
  videoPath: string;
  projectDir: string;
  cacheDir: string;
  video: Video;
  scenes: ResolvedScene[];
  totalDurationSeconds: number;
};

export type ResolvedRenderProps = {
  video: Video;
  scenes: ResolvedScene[];
  voiceoverPath?: string;
  musicPath?: string;
  totalDurationSeconds: number;
};

export function loadAndResolveVideo(videoJsonPath: string): { ok: true; value: VideoContext } | { ok: false; error: z.ZodError } {
  const absolutePath = path.resolve(videoJsonPath);
  const projectDir = path.dirname(absolutePath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
  const parsed = VideoSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const cacheDir = path.join(projectDir, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  let cursor = 0;
  const scenes = parsed.data.scenes.map((scene) => {
    const resolved: ResolvedScene = {
      ...scene,
      startSeconds: cursor
    };

    if ("image" in scene) {
      resolved.imagePath = resolveExistingAsset(projectDir, scene.image);
    }

    cursor += scene.duration;
    return resolved;
  });

  return {
    ok: true,
    value: {
      videoPath: absolutePath,
      projectDir,
      cacheDir,
      video: parsed.data,
      scenes,
      totalDurationSeconds: cursor
    }
  };
}

export function writeResolvedProps(context: VideoContext, voiceoverPath?: string): string {
  const music = context.video.audio.music;
  const musicPath = music?.mode === "file" && music.file ? resolveExistingAsset(context.projectDir, music.file) : undefined;
  const props: ResolvedRenderProps = {
    video: context.video,
    scenes: context.scenes.map((scene) => ({
      ...scene,
      imagePath: scene.imagePath ? assetDataUrl(scene.imagePath) : undefined
    })),
    voiceoverPath: voiceoverPath ? assetDataUrl(voiceoverPath) : undefined,
    musicPath: musicPath ? assetDataUrl(musicPath) : undefined,
    totalDurationSeconds: context.totalDurationSeconds
  };
  const propsPath = path.join(context.cacheDir, "render-props.json");
  fs.writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`);
  return propsPath;
}

export function resolveExistingAsset(projectDir: string, assetPath: string): string {
  const resolved = path.resolve(projectDir, assetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Missing local asset: ${assetPath} resolved to ${resolved}`);
  }
  return resolved;
}

export function printValidationErrors(error: z.ZodError) {
  for (const issue of error.issues) {
    console.error(`${issue.path.join(".") || "video"}: ${issue.message}`);
  }
}

export function exportVideoJsonSchema() {
  return zodToJsonSchema(VideoSchema, {
    name: "SceneForgeVideo",
    target: "jsonSchema7"
  });
}

function assetDataUrl(assetPath: string): string {
  const ext = path.extname(assetPath).toLowerCase();
  const mime = mimeTypes[ext] ?? "application/octet-stream";
  const data = fs.readFileSync(assetPath).toString("base64");
  return `data:${mime};base64,${data}`;
}

const mimeTypes: Record<string, string> = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webp": "image/webp"
};
