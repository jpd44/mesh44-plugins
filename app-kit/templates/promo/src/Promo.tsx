import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  Brand,
  ChecklistScene,
  EndcardScene,
  QuoteScene,
  Scene,
  ScreensScene,
  Storyboard,
  TerminalScene,
  TitleScene,
} from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Size everything off the short edge so one storyboard works in 9:16 and 16:9.
const useUnit = () => {
  const { width, height } = useVideoConfig();
  return { unit: Math.min(width, height) / 100, portrait: height > width };
};

// Fade each scene in and out so cuts are never hard.
const SceneFrame: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const fade = Math.min(8, Math.floor(frames / 4));
  const opacity = interpolate(frame, [0, fade, frames - fade, frames], [0, 1, 1, 0], clamp);
  const { unit, portrait } = useUnit();
  return (
    <AbsoluteFill
      style={{
        opacity,
        // Safe zones: keep copy clear of platform UI on vertical video.
        padding: portrait ? `${unit * 22}px ${unit * 8}px ${unit * 34}px` : `${unit * 8}px ${unit * 10}px`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Title: React.FC<{ scene: TitleScene; brand: Brand }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useUnit();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const subIn = interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], clamp);
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: unit * 11,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          transform: `translateY(${(1 - pop) * unit * 6}px) scale(${0.92 + pop * 0.08})`,
          opacity: pop,
        }}
      >
        {scene.text}
      </div>
      {scene.sub ? (
        <div
          style={{
            marginTop: unit * 4,
            fontSize: unit * 6,
            fontWeight: 600,
            color: brand.accent,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * unit * 3}px)`,
          }}
        >
          {scene.sub}
        </div>
      ) : null}
    </div>
  );
};

const Terminal: React.FC<{ scene: TerminalScene; brand: Brand; frames: number }> = ({ scene, brand, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useUnit();
  const prompt = scene.prompt ?? ">";
  const full = scene.lines.join("\n");
  const typed = Math.floor(interpolate(frame, [0.3 * fps, frames * 0.7], [0, full.length], clamp));
  const caretOn = Math.floor(frame / (fps / 2)) % 2 === 0;
  const shown = full.slice(0, typed).split("\n");
  return (
    <div
      style={{
        width: "100%",
        background: "rgba(0,0,0,0.55)",
        border: `1px solid ${brand.primary}55`,
        borderRadius: unit * 2.5,
        padding: unit * 5,
        fontFamily: brand.monoFamily ?? "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: unit * 5,
        boxShadow: `0 ${unit * 2}px ${unit * 8}px rgba(0,0,0,0.4)`,
      }}
    >
      <div style={{ display: "flex", gap: unit * 1.5, marginBottom: unit * 4 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: unit * 2, height: unit * 2, borderRadius: "50%", background: c }} />
        ))}
      </div>
      {shown.map((line, i) => (
        <div key={i} style={{ whiteSpace: "pre-wrap" }}>
          <span style={{ color: brand.accent }}>{prompt} </span>
          {line}
          {i === shown.length - 1 && caretOn ? <span style={{ color: brand.primary }}>▍</span> : null}
        </div>
      ))}
    </div>
  );
};

const Checklist: React.FC<{ scene: ChecklistScene; brand: Brand; frames: number }> = ({ scene, brand, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useUnit();
  const step = (frames * 0.75) / Math.max(1, scene.items.length);
  return (
    <div style={{ width: "100%" }}>
      {scene.heading ? (
        <div style={{ fontSize: unit * 7, fontWeight: 800, marginBottom: unit * 5 }}>{scene.heading}</div>
      ) : null}
      {scene.items.map((item, i) => {
        const start = Math.round(i * step + 0.2 * fps);
        const p = spring({ frame: frame - start, fps, config: { damping: 16 } });
        const tick = spring({ frame: frame - start - 6, fps, config: { damping: 12 } });
        return (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: unit * 3,
              fontSize: unit * 5.5,
              fontWeight: 600,
              marginBottom: unit * 3,
              opacity: p,
              transform: `translateX(${(1 - p) * -unit * 6}px)`,
            }}
          >
            <div
              style={{
                width: unit * 6,
                height: unit * 6,
                flexShrink: 0,
                borderRadius: unit * 1.5,
                background: brand.primary,
                color: brand.background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: unit * 4,
                transform: `scale(${tick})`,
              }}
            >
              ✓
            </div>
            {item}
          </div>
        );
      })}
    </div>
  );
};

const Screens: React.FC<{ scene: ScreensScene; brand: Brand; frames: number }> = ({ scene, brand, frames }) => {
  const frame = useCurrentFrame();
  const { unit, portrait } = useUnit();
  const per = frames / Math.max(1, scene.images.length);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {scene.images.map((src, i) => {
        const local = frame - i * per;
        const opacity = interpolate(local, [0, 6, per - 6, per], [0, 1, 1, 0], clamp);
        const zoom = interpolate(local, [0, per], [1, 1.06], clamp);
        return (
          <Img
            key={src}
            src={staticFile(src)}
            style={{
              position: "absolute",
              maxWidth: portrait ? "84%" : "70%",
              maxHeight: portrait ? "58%" : "64%",
              objectFit: "contain",
              borderRadius: unit * 2.5,
              boxShadow: `0 ${unit * 3}px ${unit * 10}px rgba(0,0,0,0.45)`,
              border: `1px solid ${brand.primary}44`,
              opacity,
              transform: `scale(${zoom})`,
            }}
          />
        );
      })}
      {scene.caption ? (
        <div
          style={{
            position: "absolute",
            bottom: portrait ? "24%" : "5%",
            fontSize: unit * 5.5,
            fontWeight: 700,
            padding: `${unit * 1.5}px ${unit * 4}px`,
            borderRadius: unit * 10,
            background: brand.background,
            border: `1px solid ${brand.accent}`,
          }}
        >
          {scene.caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Quote: React.FC<{ scene: QuoteScene; brand: Brand; frames: number }> = ({ scene, brand, frames }) => {
  const frame = useCurrentFrame();
  const { unit } = useUnit();
  const words = scene.text.split(" ");
  const per = (frames * 0.6) / Math.max(1, words.length);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: unit * 8, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              opacity: interpolate(frame, [i * per, i * per + 5], [0.15, 1], clamp),
              color: /[.;:]$/.test(w) ? brand.accent : undefined,
            }}
          >
            {w}{" "}
          </span>
        ))}
      </div>
      {scene.attribution ? (
        <div style={{ marginTop: unit * 4, fontSize: unit * 4, opacity: 0.7 }}>{scene.attribution}</div>
      ) : null}
    </div>
  );
};

const Endcard: React.FC<{ scene: EndcardScene; brand: Brand }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit } = useUnit();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const ctaIn = spring({ frame: frame - 0.5 * fps, fps, config: { damping: 14 } });
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {scene.logo ? (
        <Img
          src={staticFile(scene.logo)}
          style={{ height: unit * 18, marginBottom: unit * 4, transform: `scale(${pop})` }}
        />
      ) : null}
      <div style={{ fontSize: unit * 12, fontWeight: 800, opacity: pop }}>{scene.title}</div>
      {scene.cta ? (
        <div
          style={{
            marginTop: unit * 5,
            fontFamily: brand.monoFamily ?? "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: unit * 4,
            padding: `${unit * 2}px ${unit * 4}px`,
            borderRadius: unit * 2,
            background: brand.primary,
            color: brand.background,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * unit * 4}px)`,
          }}
        >
          {scene.cta}
        </div>
      ) : null}
      {scene.footnote ? (
        <div style={{ marginTop: unit * 4, fontSize: unit * 3.2, opacity: 0.6 * ctaIn }}>{scene.footnote}</div>
      ) : null}
    </div>
  );
};

const SceneView: React.FC<{ scene: Scene; brand: Brand; frames: number }> = ({ scene, brand, frames }) => {
  switch (scene.type) {
    case "title":
      return <Title scene={scene} brand={brand} />;
    case "terminal":
      return <Terminal scene={scene} brand={brand} frames={frames} />;
    case "checklist":
      return <Checklist scene={scene} brand={brand} frames={frames} />;
    case "screens":
      return <Screens scene={scene} brand={brand} frames={frames} />;
    case "quote":
      return <Quote scene={scene} brand={brand} frames={frames} />;
    case "endcard":
      return <Endcard scene={scene} brand={brand} />;
  }
};

export const Promo: React.FC<Storyboard> = (sb) => {
  const { fps } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill
      style={{ backgroundColor: sb.brand.background, color: sb.brand.foreground, fontFamily: sb.brand.fontFamily }}
    >
      {sb.background ? (
        <OffthreadVideo
          src={staticFile(sb.background)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: sb.backgroundOpacity ?? 0.35 }}
        />
      ) : null}
      {sb.scenes.map((scene, i) => {
        const frames = Math.max(1, Math.round(scene.seconds * fps));
        const seq = (
          <Sequence key={i} from={from} durationInFrames={frames} name={`${i + 1}-${scene.type}`}>
            <SceneFrame frames={frames}>
              <SceneView scene={scene} brand={sb.brand} frames={frames} />
            </SceneFrame>
          </Sequence>
        );
        from += frames;
        return seq;
      })}
    </AbsoluteFill>
  );
};
