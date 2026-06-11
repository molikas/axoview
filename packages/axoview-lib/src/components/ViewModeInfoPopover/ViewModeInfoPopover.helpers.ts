// Pure helpers for the view-mode info popover (ADR 0012). Kept free of heavy
// component imports (ReactQuill etc.) so they're unit-testable in isolation.

import { hasVisibleText } from 'src/components/NodeActionBar/NodeActionBar.helpers';

/** Normalise a possibly-schemeless link to an absolute https URL. */
export const toHref = (link: string): string =>
  /^https?:\/\//i.test(link) ? link : `https://${link}`;

/**
 * The content gate: a popover appears only for items with a non-empty name,
 * notes with visible text, or a headerLink. Empty items show nothing.
 */
export const hasInfoPopoverContent = (
  name: string | undefined,
  notes: string | undefined,
  headerLink: string | undefined
): boolean => {
  const hasName = !!name?.trim();
  const hasNotes = !!notes && hasVisibleText(notes);
  return hasName || hasNotes || !!headerLink;
};
