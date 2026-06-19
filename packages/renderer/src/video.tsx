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
    return (
      <BrandFrame theme={theme} template={template} style={baseStyle}>
        <FullImage src={scene.imagePath} />
        {scene.caption ? <Caption>{scene.caption}</Caption> : null}
      </BrandFrame>
    );
  }

  if (scene.type === "screenshot") {
    return (
      <BrandFrame theme={theme} template={template} style={baseStyle}>
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
      <BrandFrame theme={theme} template={template} style={baseStyle}>
        <div style={styles.centerStack}>
          <p style={{ ...styles.brandMark, color: theme.accentColor }}>{theme.brand}</p>
          <h1 style={styles.title}>{scene.title}</h1>
          {scene.subtitle ? <p style={styles.subtitle}>{scene.subtitle}</p> : null}
          {scene.cta ? <p style={{ ...styles.cta, backgroundColor: theme.accentColor }}>{scene.cta}</p> : null}
        </div>
      </BrandFrame>
    );
  }

  return (
    <BrandFrame theme={theme} template={template} style={baseStyle}>
      <div style={styles.centerStack}>
        <p style={{ ...styles.brandMark, color: theme.accentColor }}>{theme.brand}</p>
        <h1 style={styles.title}>{scene.title}</h1>
        {scene.subtitle ? <p style={styles.subtitle}>{scene.subtitle}</p> : null}
      </div>
    </BrandFrame>
  );
}

function BrandFrame({
  children,
  theme,
  template,
  style
}: {
  children: React.ReactNode;
  theme: ResolvedRenderProps["video"]["theme"];
  template: string;
  style: React.CSSProperties;
}) {
  const isBlazeBite = template.toLowerCase().includes("blazebite");
  return (
    <AbsoluteFill
      style={{
        ...style,
        padding: 86,
        background: isBlazeBite
          ? `linear-gradient(180deg, ${theme.backgroundColor} 0%, #101820 100%)`
          : `radial-gradient(circle at 50% 18%, #FFFFFF 0%, ${theme.backgroundColor} 54%, #E6D8C0 100%)`
      }}
    >
      <div style={{ ...styles.topRule, backgroundColor: theme.accentColor }} />
      {children}
    </AbsoluteFill>
  );
}

function FullImage({ src }: { src?: string }) {
  if (!src) {
    return null;
  }

  return (
    <div style={styles.imageShell}>
      <Img src={fileUrl(src)} style={styles.image} />
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p style={styles.caption}>{children}</p>;
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
    top: 64,
    left: 86,
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
    inset: "150px 58px 330px",
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
    left: 86,
    right: 86,
    bottom: 112,
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
