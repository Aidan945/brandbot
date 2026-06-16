import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createBrandbot } from './robot-core.js';
import model from './nexbot-model.js';
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
export const BrandBot = forwardRef(function BrandBot(props, ref) {
    const { primary, accent, visor, hands, eyes, logoText, logoColor, logoImage, legs = true, trackPointer = 'window', shadow = true, modelUrl, orbit = false, intro = true, className, style, } = props;
    const el = useRef(null);
    const bot = useRef(null);
    useEffect(() => {
        if (!el.current)
            return;
        bot.current = createBrandbot(el.current, {
            gltf: modelUrl ? null : model,
            modelUrl,
            trackPointer,
            shadow,
            legs,
            orbit,
            intro,
            ...(primary && { primary }), ...(accent && { accent }),
            ...(visor && { visor }), ...(hands && { hands }), ...(eyes && { eyes }),
            ...(logoText !== undefined && { logoText }),
            ...(logoColor && { logoColor }), ...(logoImage && { logoImage }),
        });
        return () => bot.current?.dispose();
        // structural options rebuild the scene; colors/logo flow through below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelUrl, trackPointer, shadow, orbit, intro]);
    useEffect(() => {
        bot.current?.set({ primary, accent, visor, hands, eyes, logoText, logoColor, logoImage, legs });
    }, [primary, accent, visor, hands, eyes, logoText, logoColor, logoImage, legs]);
    useImperativeHandle(ref, () => ({
        spin: () => bot.current?.spin(),
        replay: () => bot.current?.replay(),
        set: (o) => bot.current?.set(o),
    }), []);
    return createElement('div', {
        ref: el,
        className,
        style: { width: '100%', height: '100%', ...style },
    });
});
export default BrandBot;
