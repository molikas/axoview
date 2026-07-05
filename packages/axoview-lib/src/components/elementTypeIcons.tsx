import React from 'react';

// Shared element-type thumbnails (rectangle / text / label / connector), used by
// BOTH the Elements panel (LeftDock/CommonElements) and the Properties-deck
// header (ItemControls/components/DeckHeader), so the icon for each element type
// is identical everywhere the type is named. `currentColor`-based; sized via the
// `size` prop (defaults to 28 — the Elements-panel card size; the deck header
// passes a smaller size).

interface IconProps {
  size?: number;
}

export const RectangleSvg = ({ size = 28 }: IconProps) => (
  <svg
    viewBox="0 0 28 28"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="22"
      height="22"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

export const TextSvg = ({ size = 28 }: IconProps) => (
  <svg
    viewBox="0 0 28 28"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <text
      x="7"
      y="20"
      fontFamily="serif"
      fontSize="18"
      fill="currentColor"
      fontWeight="bold"
    >
      T
    </text>
  </svg>
);

export const LabelSvg = ({ size = 28 }: IconProps) => (
  <svg
    viewBox="0 0 28 28"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="8"
      width="22"
      height="12"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <line
      x1="7"
      y1="14"
      x2="21"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const ConnectorSvg = ({ size = 28 }: IconProps) => (
  <svg
    viewBox="0 0 28 28"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line
      x1="5"
      y1="14"
      x2="20"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <polyline
      points="16,10 22,14 16,18"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);
