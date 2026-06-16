import type { CSSProperties } from 'react';
import type { BrandBotHandle, Color, TrackPointer } from './types.js';
export interface BrandBotProps {
    primary?: Color;
    accent?: Color;
    visor?: Color;
    hands?: Color;
    eyes?: Color;
    logoText?: string;
    logoColor?: Color;
    /** Image logo: URL, data URI, or object URL. Overrides `logoText`. */
    logoImage?: string | null;
    /** `false` shows the upper body only. */
    legs?: boolean;
    /** Let visitors drag to rotate (for demos). */
    orbit?: boolean;
    /** One-time zoom-in when the model loads. */
    intro?: boolean;
    /** What the head watches. */
    trackPointer?: TrackPointer;
    /** Soft ground shadow. */
    shadow?: boolean;
    /** Load a different glTF instead of the bundled model. */
    modelUrl?: string;
    className?: string;
    style?: CSSProperties;
}
/**
 * <BrandBot primary="#13294b" eyes="#7fd4ff" logoText="ACME"
 *           style={{ height: 600 }} />
 *
 * A 3D robot mascot you brand with your own logo and colors. It sits locked in
 * its box, faces forward, and follows the cursor. It does NOT let visitors
 * drag-rotate unless you pass `orbit` (handy for demos).
 *
 * All color/logo props are live — change them and the robot updates.
 * Use a ref for the imperative bits: ref.current.spin() / ref.current.replay()
 */
export declare const BrandBot: import("react").ForwardRefExoticComponent<BrandBotProps & import("react").RefAttributes<BrandBotHandle>>;
export default BrandBot;
