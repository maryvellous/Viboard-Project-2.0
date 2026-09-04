import './lava.css';

// ─────────────────────────────────────────────────────────────────────────────
// Diaspro Lava — reusable lava-lamp bubble layer.
// Extracted from src/components/Sidebar.jsx (canonical) and public/banner.svg
// (wide-container adaptation). No dependency on Viboard state or logic.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical bubble configuration from Sidebar.jsx (vertical panel).
const PANEL_BUBBLES = [
  { size: 90, left: '12%', delay: 0, duration: 12 },
  { size: 60, left: '55%', delay: 3.5, duration: 15 },
  { size: 110, left: '30%', delay: 7, duration: 18 },
  { size: 50, left: '70%', delay: 1.5, duration: 11 },
  { size: 75, left: '45%', delay: 9, duration: 14 },
  { size: 45, left: '20%', delay: 5, duration: 16 },
];

// Wide-container configuration from public/banner.svg:
// same bubbles with negative delays (already mid-motion at load) plus two
// extra right-side bubbles for full-width coverage.
const BANNER_BUBBLES = [
  { size: 90, left: '12%', delay: 0, duration: 12 },
  { size: 60, left: '55%', delay: -3.5, duration: 15 },
  { size: 110, left: '30%', delay: -7, duration: 18 },
  { size: 50, left: '70%', delay: -1.5, duration: 11 },
  { size: 75, left: '45%', delay: -9, duration: 14 },
  { size: 45, left: '20%', delay: -5, duration: 16 },
  { size: 76, left: '84%', delay: -2, duration: 13 }, // extra right (banner b7)
  { size: 56, left: '94%', delay: -6, duration: 17 }, // extra far right (banner b8)
];

// Canonical colors from Sidebar.jsx.
const BUBBLE_COLORS = [
  'rgba(131, 61, 111, 0.55)',  // Plum (#833d6f)
  'rgba(154, 133, 192, 0.45)', // Lavender (#9a85c0)
  'rgba(110, 90, 142, 0.50)',  // Sidebar Purple (#6e5a8e)
  'rgba(168, 198, 222, 0.35)', // Blue Accent (#a8c6de)
  'rgba(156, 169, 139, 0.40)', // Sage (#9ca98b)
  'rgba(143, 90, 90, 0.40)',   // Terracotta (#8f5a5a)
];

// Dimmer variants for the wide-container overflow bubbles (banner b7/b8),
// derived from the canonical plum/lavender with lower opacity.
const BANNER_COLORS = [
  ...BUBBLE_COLORS,
  'rgba(131, 61, 111, 0.38)',  // Plum, dimmer
  'rgba(154, 133, 192, 0.32)', // Lavender, dimmer
];

const PRESETS = {
  panel: { bubbles: PANEL_BUBBLES, colors: BUBBLE_COLORS },
  banner: { bubbles: BANNER_BUBBLES, colors: BANNER_COLORS },
};

/**
 * Renders the Diaspro Lava bubble layer.
 *
 * The parent element must be `position: relative` and have a definite size;
 * the layer covers it fully (`position: absolute; inset: 0`) and sits behind
 * foreground content (z-index: 0). Place your content above it with a higher
 * z-index.
 *
 * @param {object}   props
 * @param {'panel'|'banner'} [props.variant='panel'] Preset layout.
 * @param {Array<{size:number,left:string,delay:number,duration:number}>} [props.bubbles]
 *   Override the bubble configuration.
 * @param {string[]} [props.colors] Override the bubble colors (cycled by index).
 * @param {string}   [props.className] Extra class for the layer.
 * @param {string}   [props.bubbleClassName] Extra class for every bubble.
 * @param {object}   [props.style] Inline style for the layer.
 */
export default function DiasproLava({
  variant = 'panel',
  bubbles,
  colors,
  className = '',
  bubbleClassName = '',
  style,
}) {
  const preset = PRESETS[variant] || PRESETS.panel;
  const resolvedBubbles = bubbles || preset.bubbles;
  const resolvedColors = colors || preset.colors;

  return (
    <div
      className={`diaspro-lava ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {resolvedBubbles.map((bubble, i) => (
        <div
          key={i}
          className={`diaspro-lava__bubble ${bubbleClassName}`.trim()}
          style={{
            width: bubble.size,
            height: bubble.size,
            left: bubble.left,
            bottom: `-${bubble.size}px`,
            background: resolvedColors[i % resolvedColors.length],
            animationDuration: `${bubble.duration}s`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
