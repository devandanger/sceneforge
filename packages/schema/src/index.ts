import fs from "node:fs";
import path from "node:path";
import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color.");
const CssColor = z.string().min(1).describe("Text or fill color as a CSS-compatible color string, preferably a hex color.");

const OverlayPosition = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);

const TextOverlay = z.object({
  type: z.literal("text").describe("Discriminator for a text overlay."),
  text: z.string().min(1).describe("Overlay text content."),
  position: OverlayPosition.default("center").describe("Preset placement within the full video frame; ignored when nested inside a group."),
  xPercent: z.number().min(0).max(100).optional().describe("Optional horizontal anchor as a percent of video width; overrides position horizontally."),
  yPercent: z.number().min(0).max(100).optional().describe("Optional vertical anchor as a percent of video height; overrides position vertically."),
  align: z.enum(["left", "center", "right"]).default("left").describe("Text alignment within the overlay box."),
  fontSizePercent: z.number().positive().max(20).default(4).describe("Font size as a percent of the shorter video side."),
  color: CssColor.optional().describe("Overlay text color; defaults to theme.primaryTextColor."),
  backgroundColor: CssColor.optional().describe("Optional background color behind the text."),
  paddingPercent: z.number().min(0).max(10).default(0).describe("Internal overlay padding as a percent of the shorter video side."),
  maxWidthPercent: z.number().positive().max(100).default(80).describe("Maximum text box width as a percent of video width."),
  opacity: z.number().min(0).max(1).default(1).describe("Overlay opacity from 0 to 1.")
});

const ImageOverlay = z.object({
  type: z.literal("image").describe("Discriminator for an image overlay."),
  src: z.string().min(1).describe("Path to a local image asset, relative to the video.json directory."),
  position: OverlayPosition.default("center").describe("Preset placement within the full video frame; ignored when nested inside a group."),
  xPercent: z.number().min(0).max(100).optional().describe("Optional horizontal anchor as a percent of video width; overrides position horizontally."),
  yPercent: z.number().min(0).max(100).optional().describe("Optional vertical anchor as a percent of video height; overrides position vertically."),
  widthPercent: z.number().positive().max(100).default(20).describe("Rendered image width as a percent of video width."),
  opacity: z.number().min(0).max(1).default(1).describe("Overlay opacity from 0 to 1.")
});

const GroupChildOverlay = z.discriminatedUnion("type", [
  TextOverlay.omit({ position: true, xPercent: true, yPercent: true }),
  ImageOverlay.omit({ position: true, xPercent: true, yPercent: true })
]).describe("Overlay that can be nested inside a group; children are laid out by the group.");

const GroupOverlay = z.object({
  type: z.literal("group").describe("Discriminator for an overlay group that stacks child overlays."),
  position: OverlayPosition.default("center").describe("Preset placement of the group within the full video frame."),
  xPercent: z.number().min(0).max(100).optional().describe("Optional horizontal group anchor as a percent of video width; overrides position horizontally."),
  yPercent: z.number().min(0).max(100).optional().describe("Optional vertical group anchor as a percent of video height; overrides position vertically."),
  direction: z.enum(["vertical", "horizontal"]).default("vertical").describe("Child layout direction; vertical behaves like a VStack, horizontal behaves like an HStack."),
  align: z.enum(["start", "center", "end", "stretch"]).default("start").describe("Child alignment on the cross axis."),
  gapPercent: z.number().min(0).max(10).default(1).describe("Gap between children as a percent of the shorter video side."),
  maxWidthPercent: z.number().positive().max(100).default(80).describe("Maximum group width as a percent of video width."),
  opacity: z.number().min(0).max(1).default(1).describe("Group opacity from 0 to 1."),
  children: z.array(GroupChildOverlay).min(1).describe("Ordered child overlays rendered inside the group.")
});

const OverlaySchema = z.discriminatedUnion("type", [
  TextOverlay,
  ImageOverlay,
  GroupOverlay
]).describe("Overlay rendered above the scene base layer; array order controls stacking order.");

// Every field carries a .describe() so the generated JSON Schema is self-documenting
// for agentic workflows. scripts/check-schema-descriptions.ts fails CI if any field
// is missing one — keep descriptions on all new fields.
const BaseScene = z.object({
  id: z.string().min(1).optional().describe("Optional stable scene identifier; used as the render sequence key."),
  duration: z.number().positive().describe("Scene duration in seconds."),
  transition: z.enum(["none", "fade", "slide-up"]).optional().describe("Entrance/exit animation; omitted scenes fade, \"none\" disables animation."),
  overlays: z.array(OverlaySchema).optional().describe("Optional overlays rendered above the scene base layer; supports text, image, and grouped stacks.")
});

const TextScene = BaseScene.extend({
  type: z.literal("text").describe("Discriminator for a title/subtitle text scene."),
  title: z.string().min(1).describe("Primary headline text."),
  subtitle: z.string().optional().describe("Optional supporting line beneath the title."),
  align: z.enum(["left", "center", "right"]).default("left").describe("Horizontal text alignment within the brand frame."),
  verticalAlign: z.enum(["top", "center", "bottom"]).default("center").describe("Vertical text alignment within the brand frame."),
  titleColor: CssColor.optional().describe("Color for the title text; defaults to theme.primaryTextColor."),
  subtitleColor: CssColor.optional().describe("Color for the subtitle text; defaults to theme.primaryTextColor.")
});

const ImageScene = BaseScene.extend({
  type: z.literal("image").describe("Discriminator for a full-bleed image scene with optional caption."),
  image: z.string().min(1).describe("Path to a local image asset, relative to the video.json directory."),
  caption: z.string().optional().describe("Optional caption rendered over the bottom of the image.")
});

const ScreenshotScene = BaseScene.extend({
  type: z.literal("screenshot").describe("Discriminator for a phone-mockup screenshot scene."),
  image: z.string().min(1).describe("Path to a local screenshot asset, relative to the video.json directory."),
  title: z.string().optional().describe("Optional heading shown above the phone mockup.")
});

const CtaScene = BaseScene.extend({
  type: z.literal("cta").describe("Discriminator for a call-to-action scene."),
  title: z.string().min(1).describe("Call-to-action headline."),
  subtitle: z.string().optional().describe("Optional supporting line beneath the CTA title."),
  cta: z.string().optional().describe("Optional button-style call-to-action label.")
});

export const SceneSchema = z.discriminatedUnion("type", [
  TextScene,
  ImageScene,
  ScreenshotScene,
  CtaScene
]);

export const VideoSchema = z.object({
  version: z.string().default("0.1").describe("SceneForge document schema version."),
  template: z.enum(["light", "dark"]).optional().describe("Named visual style; \"dark\" applies a dark gradient background, \"light\" the default soft look. Falls back to theme.brand when unset."),
  format: z.object({
    platform: z.string().default("tiktok").describe("Target platform label (informational)."),
    width: z.number().int().positive().default(1080).describe("Output width in pixels."),
    height: z.number().int().positive().default(1920).describe("Output height in pixels."),
    fps: z.number().int().positive().default(30).describe("Frames per second."),
    paddingPercent: z.number().min(0).max(25).optional().describe("Frame padding as a percent of the shorter side; defaults to 8 when both padding and paddingPercent are omitted."),
    padding: z.number().int().nonnegative().optional().describe("Explicit frame padding in pixels; overrides paddingPercent when set.")
  }).describe("Output dimensions, frame rate, and padding."),
  theme: z.object({
    brand: z.string().min(1).describe("Brand name; shown as the brand mark unless layout.brandMarkText overrides it."),
    backgroundColor: HexColor.default("#F7F2E8").describe("Base background color (6-digit hex)."),
    primaryTextColor: HexColor.default("#1E1E1E").describe("Primary text color (6-digit hex)."),
    accentColor: HexColor.default("#D9482B").describe("Accent color for the top rule, brand mark, and CTA button (6-digit hex)."),
    fontFamily: z.string().default("Inter").describe("Primary font family."),
    layout: z.object({
      showBrandMark: z.boolean().default(true).describe("Whether to render the brand mark on text/CTA scenes."),
      brandMarkText: z.string().optional().describe("Overrides the brand mark text; defaults to theme.brand."),
      showTopRule: z.boolean().default(true).describe("Whether to render the accent top rule."),
      backgroundStyle: z.enum(["flat", "soft", "bold"]).default("soft").describe("Background treatment: flat color, soft radial, or bold gradient.")
    }).default({}).describe("Toggles for renderer chrome (brand mark, top rule, background style).")
  }).describe("Brand colors, typography, and layout chrome."),
  audio: z.object({
    voiceover: z.object({
      provider: z.literal("elevenlabs").describe("TTS provider; only \"elevenlabs\" is supported."),
      voiceId: z.string().default("default").describe("ElevenLabs voice id; \"default\" uses ELEVENLABS_DEFAULT_VOICE_ID."),
      script: z.string().min(1).describe("Voiceover script text to synthesize.")
    }).optional().describe("ElevenLabs text-to-speech voiceover."),
    music: z.object({
      mode: z.enum(["none", "file"]).default("none").describe("Music source: none, or a local file."),
      file: z.string().optional().describe("Path to a local audio file, relative to video.json; required when mode is \"file\"."),
      volume: z.number().min(0).max(1).default(0.18).describe("Music volume from 0 to 1.")
    }).optional().describe("Background music track."),
    captions: z.object({
      mode: z.enum(["none", "scene"]).default("scene").describe("Caption mode: none, or per-scene captions.")
    }).optional().describe("Caption rendering settings.")
  }).default({}).describe("Optional voiceover, music, and caption settings."),
  scenes: z.array(SceneSchema).min(1).describe("Ordered list of scenes; total video duration is the sum of scene durations.")
});

export type Video = z.infer<typeof VideoSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
type GroupChildOverlayValue = z.infer<typeof GroupChildOverlay>;
type AnyOverlayValue = Overlay | GroupChildOverlayValue;

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

    validateOverlayAssets(projectDir, scene.overlays);

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
      imagePath: scene.imagePath ? assetDataUrl(scene.imagePath) : undefined,
      overlays: inlineOverlayAssets(context.projectDir, scene.overlays) as Overlay[] | undefined
    })),
    voiceoverPath: voiceoverPath ? assetDataUrl(voiceoverPath) : undefined,
    musicPath: musicPath ? assetDataUrl(musicPath) : undefined,
    totalDurationSeconds: context.totalDurationSeconds
  };
  const propsPath = path.join(context.cacheDir, "render-props.json");
  fs.writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`);
  return propsPath;
}

function validateOverlayAssets(projectDir: string, overlays?: AnyOverlayValue[]) {
  if (!overlays) {
    return;
  }

  for (const overlay of overlays) {
    if (overlay.type === "image") {
      resolveExistingAsset(projectDir, overlay.src);
    } else if (overlay.type === "group") {
      validateOverlayAssets(projectDir, overlay.children);
    }
  }
}

function inlineOverlayAssets(projectDir: string, overlays?: AnyOverlayValue[]): AnyOverlayValue[] | undefined {
  if (!overlays) {
    return undefined;
  }

  return overlays.map((overlay) => {
    if (overlay.type === "image") {
      return {
        ...overlay,
        src: assetDataUrl(resolveExistingAsset(projectDir, overlay.src))
      };
    }

    if (overlay.type === "group") {
      return {
        ...overlay,
        children: (inlineOverlayAssets(projectDir, overlay.children) ?? []) as GroupChildOverlayValue[]
      };
    }

    return overlay;
  });
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
    target: "jsonSchema7",
    // Inline every subschema so descriptions appear on each scene branch instead
    // of collapsing to a $ref to the first occurrence — agents consuming the
    // schema get docs without resolving refs.
    $refStrategy: "none"
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
