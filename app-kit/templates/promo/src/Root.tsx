import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Promo } from "./Promo";
import type { Storyboard } from "./types";
import storyboard from "../storyboard.json";

const defaults = storyboard as Storyboard;

// Duration follows the storyboard: sum of scene seconds × fps.
const calculateMetadata: CalculateMetadataFunction<Storyboard> = ({ props }) => {
  const fps = props.fps ?? 30;
  const seconds = props.scenes.reduce((sum, s) => sum + s.seconds, 0);
  return { fps, durationInFrames: Math.max(1, Math.round(seconds * fps)) };
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Promo-9x16"
      component={Promo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={600}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="Promo-16x9"
      component={Promo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={600}
      defaultProps={defaults}
      calculateMetadata={calculateMetadata}
    />
  </>
);
