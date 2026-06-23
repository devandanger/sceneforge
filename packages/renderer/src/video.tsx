import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type { Overlay, ResolvedRenderProps, ResolvedScene } from "@sceneforge/schema";

export function SceneForgeVideo(props: ResolvedRenderProps) {
  const { fps } = useVideoConfig();
  const template = props.video.template ?? props.video.theme.brand;

  return (
    <AbsoluteFill style={{ backgroundColor: props.video.theme.backgroundColor }}>
      {props.voiceoverPath ? <Audio src={fileUrl(props.voiceoverPath)} /> : null}
      {props.musicPath ? <Audio src={fileUrl(props.musicPath)} volume={props.video.audio.music?.volume ?? 0.18} /> : null}
      {props.scenes.map((scene, index) => (
        <Sequence
          key={scene.id ?? `${scene.type}-${index}`}
          from={Math.round(scene.startSeconds * fps)}
          durationInFrames={Math.round(scene.duration * fps)}
        >
          <Scene scene={scene} props={props} template={template} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function Scene({ scene, props, template }: { scene: ResolvedScene; props: ResolvedRenderProps; template: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = scene.duration * fps;
  const fade = interpolate(frame, [0, 12, durationFrames - 12, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const y = scene.transition === "slide-up"
    ? interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" })
    : 0;

  const theme = props.video.theme;
  const baseStyle: React.CSSProperties = {
    color: theme.primaryTextColor,
    fontFamily: `${theme.fontFamily}, Inter, Arial, sans-serif`,
    opacity: scene.transition === "none" ? 1 : fade,
    transform: `translateY(${y}px)`
  };

  if (scene.type === "image") {
    const padding = getPadding(props.video.format);
    return (
      <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
        <FullImage padding={padding} src={scene.imagePath} />
        {scene.caption ? <Caption padding={padding}>{scene.caption}</Caption> : null}
        <OverlayLayer format={props.video.format} overlays={scene.overlays} theme={theme} />
      </BrandFrame>
    );
  }

  if (scene.type === "video") {
    const padding = getPadding(props.video.format);
    return (
      <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
        <div
          style={{
            ...styles.imageShell,
            inset: `${padding + 64}px ${Math.max(0, padding - 28)}px ${padding + 244}px`
          }}
        >
          <OffthreadVideo
            src={videoSrcUrl(scene.videoSrc)}
            trimBefore={Math.round((scene.trimStart ?? 0) * fps)}
            muted={scene.muted}
            volume={scene.muted ? 0 : scene.volume}
            playbackRate={scene.playbackRate}
            style={{ width: "100%", height: "100%", objectFit: scene.fit }}
          />
        </div>
        {scene.caption ? <Caption padding={padding}>{scene.caption}</Caption> : null}
        <OverlayLayer format={props.video.format} overlays={scene.overlays} theme={theme} />
      </BrandFrame>
    );
  }

  if (scene.type === "screenshot") {
    return (
      <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
        <div style={styles.screenshotLayout}>
          {scene.title ? <h2 style={styles.sceneHeading}>{scene.title}</h2> : null}
          <div style={{ ...styles.phone, borderColor: theme.primaryTextColor }}>
            <Img src={fileUrl(scene.imagePath)} style={styles.phoneImage} />
          </div>
        </div>
        <OverlayLayer format={props.video.format} overlays={scene.overlays} theme={theme} />
      </BrandFrame>
    );
  }

  if (scene.type === "cta") {
    return (
      <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
        <div style={styles.centerStack}>
          <BrandMark theme={theme} />
          <h1 style={styles.title}>{scene.title}</h1>
          {scene.subtitle ? <p style={styles.subtitle}>{scene.subtitle}</p> : null}
          {scene.cta ? <p style={{ ...styles.cta, backgroundColor: theme.accentColor }}>{scene.cta}</p> : null}
        </div>
        <OverlayLayer format={props.video.format} overlays={scene.overlays} theme={theme} />
      </BrandFrame>
    );
  }

  return (
    <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
      <div style={getTextStackStyle(scene.align, scene.verticalAlign)}>
        <BrandMark theme={theme} />
        <h1 style={{ ...styles.title, textAlign: scene.align, color: scene.titleColor ?? theme.primaryTextColor }}>{scene.title}</h1>
        {scene.subtitle ? <p style={{ ...styles.subtitle, textAlign: scene.align, color: scene.subtitleColor ?? theme.primaryTextColor }}>{scene.subtitle}</p> : null}
      </div>
      <OverlayLayer format={props.video.format} overlays={scene.overlays} theme={theme} />
    </BrandFrame>
  );
}

function BrandFrame({
  children,
  format,
  theme,
  template,
  style
}: {
  children: React.ReactNode;
  format: ResolvedRenderProps["video"]["format"];
  theme: ResolvedRenderProps["video"]["theme"];
  template: string;
  style: React.CSSProperties;
}) {
  const isDark = template.toLowerCase() === "dark";
  const background = getBackground(theme, isDark);
  const padding = getPadding(format);
  return (
    <AbsoluteFill
      style={{
        ...style,
        padding,
        background
      }}
    >
      {theme.layout.showTopRule ? (
        <div
          style={{
            ...styles.topRule,
            top: Math.max(24, padding * 0.75),
            left: padding,
            backgroundColor: theme.accentColor
          }}
        />
      ) : null}
      {children}
    </AbsoluteFill>
  );
}

function BrandMark({ theme }: { theme: ResolvedRenderProps["video"]["theme"] }) {
  if (!theme.layout.showBrandMark) {
    return null;
  }

  return <p style={{ ...styles.brandMark, color: theme.accentColor }}>{theme.layout.brandMarkText ?? theme.brand}</p>;
}

function getBackground(theme: ResolvedRenderProps["video"]["theme"], isDark: boolean) {
  if (theme.layout.backgroundStyle === "flat") {
    return theme.backgroundColor;
  }

  if (theme.layout.backgroundStyle === "bold" || isDark) {
    return `linear-gradient(180deg, ${theme.backgroundColor} 0%, #101820 100%)`;
  }

  return `radial-gradient(circle at 50% 18%, #FFFFFF 0%, ${theme.backgroundColor} 54%, #E6D8C0 100%)`;
}

function getPadding(format: ResolvedRenderProps["video"]["format"]) {
  if (format.padding !== undefined) {
    return format.padding;
  }

  const paddingPercent = format.paddingPercent ?? 8;
  return Math.round(Math.min(format.width, format.height) * (paddingPercent / 100));
}

function getTextStackStyle(align: "left" | "center" | "right", verticalAlign: "top" | "center" | "bottom"): React.CSSProperties {
  const justifyContent = {
    top: "flex-start",
    center: "center",
    bottom: "flex-end"
  }[verticalAlign];

  const alignItems = {
    left: "flex-start",
    center: "center",
    right: "flex-end"
  }[align];

  return {
    ...styles.centerStack,
    justifyContent,
    alignItems
  };
}

function OverlayLayer({
  format,
  overlays,
  theme
}: {
  format: ResolvedRenderProps["video"]["format"];
  overlays?: Overlay[];
  theme: ResolvedRenderProps["video"]["theme"];
}) {
  if (!overlays?.length) {
    return null;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {overlays.map((overlay, index) => (
        <OverlayItem key={index} format={format} overlay={overlay} theme={theme} />
      ))}
    </AbsoluteFill>
  );
}

function OverlayItem({
  format,
  inGroup = false,
  overlay,
  theme
}: {
  format: ResolvedRenderProps["video"]["format"];
  inGroup?: boolean;
  overlay: Overlay;
  theme: ResolvedRenderProps["video"]["theme"];
}) {
  const { fps } = useVideoConfig();
  const frameStyle = inGroup ? undefined : getOverlayPositionStyle(overlay, format);

  if (overlay.type === "text") {
    return (
      <div style={{ ...frameStyle, ...getOverlayTextStyle(overlay, format, theme) }}>
        {overlay.text}
      </div>
    );
  }

  if (overlay.type === "image") {
    return (
      <div style={{ ...frameStyle, width: `${overlay.widthPercent}%`, opacity: overlay.opacity }}>
        <Img src={fileUrl(overlay.src)} style={{ width: "100%", display: "block" }} />
      </div>
    );
  }

  if (overlay.type === "video") {
    return (
      <div style={{ ...frameStyle, width: `${overlay.widthPercent}%`, opacity: overlay.opacity }}>
        <OffthreadVideo
          src={videoSrcUrl(overlay.src)}
          trimBefore={Math.round((overlay.trimStart ?? 0) * fps)}
          muted={overlay.muted}
          volume={overlay.muted ? 0 : overlay.volume}
          playbackRate={overlay.playbackRate}
          style={{ width: "100%", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...frameStyle, ...getGroupStyle(overlay, format) }}>
      {overlay.children.map((child, index) => (
        <OverlayItem key={index} format={format} inGroup overlay={child as Overlay} theme={theme} />
      ))}
    </div>
  );
}

function getOverlayPositionStyle(overlay: Overlay, format: ResolvedRenderProps["video"]["format"]): React.CSSProperties {
  const anchor = getOverlayAnchor(overlay.position, overlay.xPercent, overlay.yPercent);
  return {
    position: "absolute",
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
    transform: `translate(${anchor.translateX}%, ${anchor.translateY}%)`,
    maxWidth: `${"maxWidthPercent" in overlay ? overlay.maxWidthPercent : 100}%`
  };
}

function getOverlayAnchor(position: Overlay["position"], xPercent?: number, yPercent?: number) {
  const presets: Record<Overlay["position"], { x: number; y: number; translateX: number; translateY: number }> = {
    "top-left": { x: 0, y: 0, translateX: 0, translateY: 0 },
    "top-center": { x: 50, y: 0, translateX: -50, translateY: 0 },
    "top-right": { x: 100, y: 0, translateX: -100, translateY: 0 },
    "center-left": { x: 0, y: 50, translateX: 0, translateY: -50 },
    center: { x: 50, y: 50, translateX: -50, translateY: -50 },
    "center-right": { x: 100, y: 50, translateX: -100, translateY: -50 },
    "bottom-left": { x: 0, y: 100, translateX: 0, translateY: -100 },
    "bottom-center": { x: 50, y: 100, translateX: -50, translateY: -100 },
    "bottom-right": { x: 100, y: 100, translateX: -100, translateY: -100 }
  };
  const preset = presets[position];

  return {
    ...preset,
    x: xPercent ?? preset.x,
    y: yPercent ?? preset.y
  };
}

function getOverlayTextStyle(
  overlay: Extract<Overlay, { type: "text" }>,
  format: ResolvedRenderProps["video"]["format"],
  theme: ResolvedRenderProps["video"]["theme"]
): React.CSSProperties {
  const basis = Math.min(format.width, format.height);
  return {
    color: overlay.color ?? theme.primaryTextColor,
    backgroundColor: overlay.backgroundColor,
    fontSize: Math.round(basis * (overlay.fontSizePercent / 100)),
    fontWeight: 800,
    lineHeight: 1.08,
    maxWidth: `${overlay.maxWidthPercent}%`,
    opacity: overlay.opacity,
    padding: Math.round(basis * (overlay.paddingPercent / 100)),
    textAlign: overlay.align,
    whiteSpace: "pre-wrap"
  };
}

function getGroupStyle(overlay: Extract<Overlay, { type: "group" }>, format: ResolvedRenderProps["video"]["format"]): React.CSSProperties {
  const basis = Math.min(format.width, format.height);
  const alignItems = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch"
  }[overlay.align];

  return {
    display: "flex",
    flexDirection: overlay.direction === "vertical" ? "column" : "row",
    alignItems,
    gap: Math.round(basis * (overlay.gapPercent / 100)),
    maxWidth: `${overlay.maxWidthPercent}%`,
    opacity: overlay.opacity
  };
}

function FullImage({ padding, src }: { padding: number; src?: string }) {
  if (!src) {
    return null;
  }

  return (
    <div
      style={{
        ...styles.imageShell,
        inset: `${padding + 64}px ${Math.max(0, padding - 28)}px ${padding + 244}px`
      }}
    >
      <Img src={fileUrl(src)} style={styles.image} />
    </div>
  );
}

function Caption({ children, padding }: { children: React.ReactNode; padding: number }) {
  return (
    <p
      style={{
        ...styles.caption,
        left: padding,
        right: padding,
        bottom: padding + 26
      }}
    >
      {children}
    </p>
  );
}

function fileUrl(src?: string) {
  if (!src) {
    return "";
  }
  if (src.startsWith("http") || src.startsWith("file:") || src.startsWith("data:")) {
    return src;
  }
  return `file://${src}`;
}

// Video clips are staged into the Remotion public dir and referenced by name, so
// a bare staged name resolves via staticFile(); http(s) URLs pass through. This
// loads in both Studio (over http) and render, unlike a file:// path.
function videoSrcUrl(src?: string) {
  if (!src) {
    return "";
  }
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("file:")) {
    return src;
  }
  return staticFile(src);
}

const styles: Record<string, React.CSSProperties> = {
  topRule: {
    position: "absolute",
    width: 140,
    height: 10,
    borderRadius: 5
  },
  centerStack: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    height: "100%",
    gap: 30
  },
  brandMark: {
    margin: 0,
    fontSize: 38,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    margin: 0,
    fontSize: 106,
    lineHeight: 1,
    maxWidth: 900,
    fontWeight: 900,
    letterSpacing: 0
  },
  subtitle: {
    margin: 0,
    fontSize: 48,
    lineHeight: 1.18,
    maxWidth: 820,
    fontWeight: 600
  },
  cta: {
    alignSelf: "flex-start",
    margin: "22px 0 0",
    padding: "26px 34px",
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: 850
  },
  imageShell: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 8,
    boxShadow: "0 30px 80px rgba(0,0,0,0.22)"
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  caption: {
    position: "absolute",
    margin: 0,
    fontSize: 58,
    lineHeight: 1.08,
    fontWeight: 850
  },
  screenshotLayout: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 54
  },
  sceneHeading: {
    margin: 0,
    width: "100%",
    fontSize: 72,
    lineHeight: 1.04,
    fontWeight: 900,
    textAlign: "left"
  },
  phone: {
    width: 520,
    height: 1060,
    border: "18px solid",
    borderRadius: 72,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 30px 90px rgba(0,0,0,0.24)"
  },
  phoneImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  }
};
