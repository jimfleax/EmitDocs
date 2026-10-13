import type { CSSProperties, FC } from "react";

export interface TechTextProps {
  /** The wordmark to render. Default: 'React Bits' */
  text?: string;
  /** Any font family loaded on the page. Leave empty to inherit the font of the container. Default: '' */
  fontFamily?: string;
  /** Weight of the wordmark. Default: 600 */
  fontWeight?: number;
  /** Largest font size in px. The wordmark shrinks to fit narrower containers. Default: 150 */
  fontSize?: number;
  /** Extra space between letters, in em. Default: -0.05 */
  letterSpacing?: number;
  /** Colour of the letters and their outlines. Default: '#ffffff' */
  color?: string;
  /** Colour of the selection frame, connector and labels. Default: '#ffffff' */
  accentColor?: string;
  /** Colour of the outline dashes when revealed. Defaults to accentColor or color. */
  outlineColor?: string;
  /** Radius around the pointer where the letters turn into vector outlines, in px. Default: 200 */
  reach?: number;
  /** How gradually the fill hands over to the outlines. 0 is a hard edge. Default: 0.7 */
  softness?: number;
  /** Length of each outline dash, in px. Default: 4 */
  dashLength?: number;
  /** Space between outline dashes, in px. Default: 2 */
  dashGap?: number;
  /** Thickness of the outline, in px. Default: 1.5 */
  strokeWidth?: number;
  /** How the outlines under the pointer are drawn. Default: 'dashed' */
  lineStyle?: "dashed" | "solid";
  /** Area fades the letters into outlines inside a circle around the pointer. Letter turns only the active letter into its outline. Off keeps every letter solid. Default: 'letter' */
  reveal?: "area" | "letter" | "off";
  /** Tiny squares that blink and respawn around the active letter, seeded per letter. 0 turns them off. Default: 15 */
  specks?: number;
  /** Frame the letter under the pointer. The frame glides from letter to letter. Default: true */
  selection?: boolean;
  /** Label the frame with the letter and its size, or with its offset while dragged. Default: true */
  labels?: boolean;
  /** Let letters be dragged off the baseline. They spring back home on release. Default: true */
  draggable?: boolean;
  /** Sweep the reveal across the wordmark on its own while the pointer is away. Default: true */
  sweep?: boolean;
  /** Speed of the idle sweep. Default: 1 */
  speed?: number;
  /** Extra classes on the container. Default: '' */
  className?: string;
  /** Inline styles on the container. */
  style?: CSSProperties;
}

declare const TechText: FC<TechTextProps>;

export default TechText;
