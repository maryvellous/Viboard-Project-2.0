/**
 * Diaspro B7 — the canonical brand mark.
 *
 * Geometry is frozen; do NOT reinterpret it. The values below are the spec:
 *   viewed box 220×220 · rect x26 y26 w168 h168 rx28 fill #7A3F67 (plum)
 *   letter "d" white, Outfit 700, font-size 116, x 56, baseline y 149
 *   tilt −7° about (96, 112)
 *   bubbles, largest → smallest: Sand #E8D19E (144,86,r13),
 *   Blue #A5C4DC (162,68,r8), Sage #98A78A (151,51,r5)
 *
 * Outfit must be loaded by the app (globals.css imports it); the SVG font-family
 * only names it. Where the font is unavailable the glyph falls back to the
 * system sans — the box, tilt and bubbles stay identical.
 */
import { cn } from "@/lib/utils";

interface DiasproLogoProps {
  /** Square size in px. Omit to fill the parent box. */
  size?: number;
  className?: string;
  /** Decorative by default (labelled by adjacent text) — pass a title to expose it. */
  title?: string;
}

export function DiasproLogo({ size, className, title }: DiasproLogoProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={cn("block", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect x="26" y="26" width="168" height="168" rx="28" fill="#7A3F67" />
      <g transform="rotate(-7 96 112)">
        <text
          x="56"
          y="149"
          fontFamily="Outfit"
          fontSize="116"
          fontWeight="700"
          fill="#FFFFFF"
        >
          d
        </text>
      </g>
      <circle cx="144" cy="86" r="13" fill="#E8D19E" />
      <circle cx="162" cy="68" r="8" fill="#A5C4DC" />
      <circle cx="151" cy="51" r="5" fill="#98A78A" />
    </svg>
  );
}
