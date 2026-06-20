import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type { ResolvedRenderProps, ResolvedScene } from "@sceneforge/schema";

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
      </BrandFrame>
    );
  }

  return (
    <BrandFrame format={props.video.format} theme={theme} template={template} style={baseStyle}>
      <div style={getTextStackStyle(scene.align, scene.verticalAlign)}>
        <BrandMark theme={theme} />
        <h1 style={{ ...styles.title, textAlign: scene.align }}>{scene.title}</h1>
        {scene.subtitle ? <p style={{ ...styles.subtitle, textAlign: scene.align }}>{scene.subtitle}</p> : null}
      </div>
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
  const isBlazeBite = template.toLowerCase().includes("blazebite");
  const background = getBackground(theme, isBlazeBite);
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

function getBackground(theme: ResolvedRenderProps["video"]["theme"], isBlazeBite: boolean) {
  if (theme.layout.backgroundStyle === "flat") {
    return theme.backgroundColor;
  }

  if (theme.layout.backgroundStyle === "bold" || isBlazeBite) {
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
