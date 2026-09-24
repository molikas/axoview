import chroma from 'chroma-js';
import { Icon, EditorModeEnum, Mode } from 'src/types';

// Formats 16 random bytes as an RFC 4122 v4 UUID (sets the version/variant bits).
const formatUuidV4 = (bytes: Uint8Array) => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const generateId = () => {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // crypto.randomUUID is gated to secure contexts (HTTPS / localhost). A
  // self-hosted instance opened over plain HTTP by LAN IP has `crypto` but not
  // `randomUUID`, which used to throw on the very first load (issue #89).
  // getRandomValues is not secure-context-gated, so build the v4 UUID from it.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return formatUuidV4(bytes);
};

export const clamp = (num: number, min: number, max: number) => {
  return Math.max(Math.min(num, max), min);
};

export const roundToTwoDecimalPlaces = (num: number) => {
  return Math.round(num * 100) / 100;
};

interface GetColorVariantOpts {
  alpha?: number;
  grade?: number;
}

export const getColorVariant = (
  color: string,
  variant: 'light' | 'dark',
  { alpha = 1, grade = 1 }: GetColorVariantOpts
) => {
  switch (variant) {
    case 'light':
      return chroma(color).brighten(grade).alpha(alpha).css();
    case 'dark': {
      const darkened = chroma(color).darken(grade);
      // Saturating a NEUTRAL grey fabricates a hue: grey has ~0 LCH chroma and
      // an undefined hue, so `.saturate()` boosts chroma around chroma-js's
      // fallback hue and the result reads warm — the "grey connector / border
      // renders orange, not grey" bug. Only boost saturation when the input
      // actually has a hue; achromatic input darkens straight down the grey
      // axis. Coloured input is byte-for-byte unchanged.
      const hasHue = chroma(color).get('lch.c') >= 1;
      const adjusted = hasHue ? darkened.saturate(grade) : darkened;
      return adjusted.alpha(alpha).css();
    }
    default:
      return chroma(color).alpha(alpha).css();
  }
};

export const setWindowCursor = (cursor: string) => {
  window.document.body.style.cursor = cursor;
};

export const toPx = (value: number | string) => {
  return `${value}px`;
};

export const categoriseIcons = (icons: Icon[]) => {
  const categories: { name?: string; icons: Icon[] }[] = [];

  icons.forEach((icon) => {
    const collection = categories.find((cat) => {
      return cat.name === icon.collection;
    });

    if (!collection) {
      categories.push({ name: icon.collection, icons: [icon] });
    } else {
      collection.icons.push(icon);
    }
  });

  return categories;
};

export const getStartingMode = (
  editorMode: keyof typeof EditorModeEnum
): Mode => {
  switch (editorMode) {
    case 'EDITABLE':
      return { type: 'CURSOR', showCursor: true, mousedownItem: null };
    case 'EXPLORABLE_READONLY':
      return { type: 'PAN', showCursor: false };
    case 'NON_INTERACTIVE':
      return { type: 'INTERACTIONS_DISABLED', showCursor: false };
    default:
      throw new Error('Invalid editor mode.');
  }
};

export function getItemByIdOrThrow<T extends { id: string }>(
  values: T[],
  id: string
): { value: T; index: number } {
  const index = values.findIndex((val) => {
    return val.id === id;
  });

  if (index === -1) {
    throw new Error(`Item with id "${id}" not found.`);
  }

  return { value: values[index], index };
}

export function getItemById<T extends { id: string }>(
  values: T[],
  id: string
): { value: T; index: number } | null {
  const index = values.findIndex((val) => {
    return val.id === id;
  });

  if (index === -1) {
    return null;
  }

  return { value: values[index], index };
}
