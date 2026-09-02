import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight animated line icons (lucide geometry) driven by a single
 * `active` boolean so a parent card can trigger the animation on hover.
 */
export type AnimatedIconProps = {
  active?: boolean;
  className?: string;
};

const ease: Transition["ease"] = "easeInOut";

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Shield with a check that redraws — "verified / fair play". */
export function ShieldCheckIcon({ active, className }: AnimatedIconProps) {
  const state = active ? "animate" : "normal";
  return (
    <motion.svg
      {...svgProps}
      className={cn(className)}
      style={{ transformOrigin: "center" }}
      variants={{
        normal: { scale: 1, rotate: 0 },
        animate: { scale: [1, 1.1, 1], rotate: [0, -4, 0] },
      }}
      animate={state}
      transition={{ duration: 0.45, ease }}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={{
          normal: { pathLength: 1, opacity: 1 },
          animate: { pathLength: [0, 1], opacity: [0, 1] },
        }}
        animate={state}
        transition={{ duration: 0.4, delay: 0.15, ease }}
      />
    </motion.svg>
  );
}

/** Bank building — roof drops in, columns rise in sequence. */
export function LandmarkIcon({ active, className }: AnimatedIconProps) {
  const state = active ? "animate" : "normal";
  const columns = ["M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7"];
  return (
    <motion.svg
      {...svgProps}
      className={cn(className)}
      style={{ transformOrigin: "center" }}
      variants={{ normal: { scale: 1 }, animate: { scale: [1, 1.06, 1] } }}
      animate={state}
      transition={{ duration: 0.5, ease }}
    >
      <motion.path
        d="M12 2 20 7 4 7Z"
        variants={{ normal: { y: 0, opacity: 1 }, animate: { y: [-4, 0], opacity: [0, 1] } }}
        animate={state}
        transition={{ duration: 0.35, ease }}
      />
      <path d="M3 22h18" />
      {columns.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          variants={{ normal: { opacity: 1, y: 0 }, animate: { opacity: [0, 1], y: [3, 0] } }}
          animate={state}
          transition={{ duration: 0.3, delay: 0.12 + i * 0.07, ease }}
        />
      ))}
    </motion.svg>
  );
}

/** Support headset — gentle listening rock. */
export function HeadsetIcon({ active, className }: AnimatedIconProps) {
  return (
    <motion.svg
      {...svgProps}
      className={cn(className)}
      style={{ transformOrigin: "center" }}
      variants={{ normal: { rotate: 0 }, animate: { rotate: [0, -9, 9, -5, 0] } }}
      animate={active ? "animate" : "normal"}
      transition={{ duration: 0.6, ease }}
    >
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-8a9 9 0 0 1 18 0v8a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
    </motion.svg>
  );
}

/** Trophy — a victorious raise. */
export function TrophyIcon({ active, className }: AnimatedIconProps) {
  return (
    <motion.svg
      {...svgProps}
      className={cn(className)}
      style={{ transformOrigin: "center" }}
      variants={{
        normal: { rotate: 0, scale: 1, y: 0 },
        animate: { rotate: [0, -7, 7, 0], scale: [1, 1.12, 1], y: [0, -2, 0] },
      }}
      animate={active ? "animate" : "normal"}
      transition={{ duration: 0.55, ease }}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </motion.svg>
  );
}
