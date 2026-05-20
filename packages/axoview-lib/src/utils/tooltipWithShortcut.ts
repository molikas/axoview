export const tooltipWithShortcut = (
  label: string,
  shortcut?: string | null
): string => {
  if (!shortcut) return label;
  return `${label} (${shortcut})`;
};
