import { Composition } from "remotion";
import { registerRoot } from "remotion";
import { SceneForgeVideo } from "./video.tsx";
import type { ResolvedRenderProps } from "@sceneforge/schema";

const defaultProps: ResolvedRenderProps = {
  video: {
    version: "0.1",
    template: "naprej",
    format: {
      platform: "tiktok",
      width: 1080,
      height: 1920,
      fps: 30
    },
    theme: {
      brand: "naprej",
      backgroundColor: "#F7F2E8",
      primaryTextColor: "#1E1E1E",
      accentColor: "#D9482B",
      fontFamily: "Inter"
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
        subtitle: "JSON-driven short-form video."
      }
    ]
  },
  scenes: [
    {
      type: "text",
      duration: 3,
      title: "SceneForge",
      subtitle: "JSON-driven short-form video.",
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
