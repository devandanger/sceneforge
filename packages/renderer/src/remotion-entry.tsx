import { Composition } from "remotion";
import { registerRoot } from "remotion";
import { SceneForgeVideo } from "./video.tsx";
import type { ResolvedRenderProps } from "@sceneforge/schema";

const defaultProps: ResolvedRenderProps = {
  video: {
    version: "0.1",
    template: "light",
    format: {
      platform: "tiktok",
      width: 1080,
      height: 1920,
      fps: 30,
      paddingPercent: 8
    },
    theme: {
      brand: "SceneForge",
      backgroundColor: "#F7F2E8",
      primaryTextColor: "#1E1E1E",
      accentColor: "#D9482B",
      fontFamily: "Inter",
      layout: {
        showBrandMark: true,
        showTopRule: true,
        backgroundStyle: "soft"
      }
    },
    audio: {
      music: {
        mode: "none",
        volume: 0.18
      },
      captions: {
        mode: "scene"
      }
    },
    scenes: [
      {
        type: "text",
        duration: 3,
        title: "SceneForge",
        subtitle: "JSON-driven short-form video.",
        align: "left",
        verticalAlign: "center"
      }
    ]
  },
  scenes: [
    {
      type: "text",
      duration: 3,
      title: "SceneForge",
      subtitle: "JSON-driven short-form video.",
      align: "left",
      verticalAlign: "center",
      startSeconds: 0
    }
  ],
  totalDurationSeconds: 3
};

const Root = () => (
  <Composition
    id="SceneForge"
    component={SceneForgeVideo}
    defaultProps={defaultProps}
    durationInFrames={defaultProps.totalDurationSeconds * defaultProps.video.format.fps}
    fps={defaultProps.video.format.fps}
    width={defaultProps.video.format.width}
    height={defaultProps.video.format.height}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil(props.totalDurationSeconds * props.video.format.fps),
      fps: props.video.format.fps,
      width: props.video.format.width,
      height: props.video.format.height
    })}
  />
);

registerRoot(Root);
