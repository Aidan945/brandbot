import type * as THREE from 'three';

/** A CSS color string, e.g. "#13294b". */
export type Color = string;

/** Where the head watches the cursor. */
export type TrackPointer = 'window' | 'element' | false;

/** Options for the framework-agnostic engine, `createBrandbot`. */
export interface BrandbotOptions {
  /** Parsed glTF JSON (e.g. `import model from 'brandbot/model'`). */
  gltf?: unknown;
  /** ...or a URL to a .gltf/.glb, used if `gltf` is not given. */
  modelUrl?: string | null;
  /** What the head watches. Default `'window'`. */
  trackPointer?: TrackPointer;
  /** Soft ground shadow. Default `true`. */
  shadow?: boolean;
  /** `false` shows the upper body only. Default `true`. */
  legs?: boolean;
  /** `true` lets visitors drag to rotate (for demos). Default `false`. */
  orbit?: boolean;
  /** One-time zoom-in when the model loads. Default `true`. */
  intro?: boolean;
  /** Camera framing. */
  camera?: { position: [number, number, number]; target: [number, number, number]; fov: number };
  primary?: Color;
  accent?: Color;
  visor?: Color;
  hands?: Color;
  eyes?: Color;
  logoText?: string;
  logoColor?: Color;
  /** Image logo: URL, data URI, or object URL. Overrides `logoText`. */
  logoImage?: string | null;
}

/** Live updates accepted by `robot.set(...)`. */
export type BrandbotUpdate = Partial<Pick<BrandbotOptions,
  'primary' | 'accent' | 'visor' | 'hands' | 'eyes' | 'logoText' | 'logoColor' | 'logoImage' | 'legs'>>;

/** The handle returned by `createBrandbot`. */
export interface BrandbotInstance {
  /** Update colors / logo / legs live. */
  set(update?: BrandbotUpdate): BrandbotInstance;
  /** Do one full turn. */
  spin(): void;
  /** Replay the zoom-in intro. */
  replay(): void;
  /** Tear down: stops the loop, removes listeners, frees GPU resources. */
  dispose(): void;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

/** Imperative handle exposed via the React component's ref. */
export interface BrandBotHandle {
  spin(): void;
  replay(): void;
  set(update?: BrandbotUpdate): void;
}
