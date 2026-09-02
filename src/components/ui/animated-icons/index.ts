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
export { UserPlusIcon, type UserPlusIconHandle } from "./user-plus";
export { LocateFixedIcon, type LocateFixedIconHandle } from "./locate-fixed";
export { WalletIcon, type WalletIconHandle } from "./wallet";
export { ZapIcon, type ZapIconHandle } from "./zap";
export { BicepsFlexedIcon, type BicepsFlexedIconHandle } from "./biceps-flexed";
export { UsersIcon, type UsersIconHandle } from "./users";
export { SearchIcon, type SearchIconHandle } from "./search";
export { LockIcon, type LockIconHandle } from "./lock";
export { ChartColumnIcon, type ChartColumnIconHandle } from "./chart-column";
export { ReceiptTextIcon, type ReceiptTextIconHandle } from "./receipt-text";
export { MailIcon, type MailIconHandle } from "./mail";
export { MessageCircleIcon, type MessageCircleIconHandle } from "./message-circle";
export { GlobeIcon, type GlobeIconHandle } from "./globe";

/** Every icon in this set exposes the same imperative handle. */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};
