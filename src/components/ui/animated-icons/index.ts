/**
 * Animated line icons from AnimateIcons (https://animateicons.in) by Avijit Dey — MIT.
 * Ported to this project's `framer-motion` instead of the upstream `motion/react`.
 *
 * Each icon animates on its own hover when used bare. Attach a ref and the icon
 * hands control over instead, so a parent (a badge pill, a card) can drive it:
 *
 *   const ref = useRef<AnimatedIconHandle>(null);
 *   <div onMouseEnter={() => ref.current?.startAnimation()}
 *        onMouseLeave={() => ref.current?.stopAnimation()}>
 *     <CoinsIcon ref={ref} size={14} />
 *   </div>
 */
export { CoinsIcon, type CoinsIconHandle } from "./coins";
export { GamepadIcon, type GamepadIconHandle } from "./gamepad";
export { ShieldCheckIcon, type ShieldCheckIconHandle } from "./shield-check";
export { HeadsetIcon, type HeadsetIconHandle } from "./headset";
export { BanknoteIcon, type BanknoteIconHandle } from "./banknote";
export { SwordsIcon, type SwordsIconHandle } from "./swords";

/** Every icon in this set exposes the same imperative handle. */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};
