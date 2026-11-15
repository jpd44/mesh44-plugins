// Storyboard schema. storyboard.json is the only file you normally edit:
// the scenes, their order and their timing all come from it.

export type Brand = {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  fontFamily: string;
  monoFamily?: string;
};

export type TitleScene = { type: "title"; seconds: number; text: string; sub?: string };
export type TerminalScene = { type: "terminal"; seconds: number; lines: string[]; prompt?: string };
export type ChecklistScene = { type: "checklist"; seconds: number; heading?: string; items: string[] };
// images are file names in public/ (Playwright screenshots from the visual-qa step)
export type ScreensScene = { type: "screens"; seconds: number; images: string[]; caption?: string };
export type QuoteScene = { type: "quote"; seconds: number; text: string; attribution?: string };
export type EndcardScene = { type: "endcard"; seconds: number; title: string; cta?: string; logo?: string; footnote?: string };

export type Scene =
  | TitleScene
  | TerminalScene
  | ChecklistScene
  | ScreensScene
  | QuoteScene
  | EndcardScene;

export type Storyboard = {
  fps?: number;
  brand: Brand;
  // Optional video in public/ (e.g. a Blender-rendered mesh loop) drawn behind every scene.
  // Render it at least as long as the whole storyboard; it does not loop.
  background?: string;
  backgroundOpacity?: number;
  scenes: Scene[];
};
