import { useMemo } from 'react';
import { getItemById } from 'src/utils';
import { useScene } from 'src/hooks/useScene';

// Reactive selector for a single floating Label (ADR 0031) by id. Mirrors
// useTextBox; returns null when the id is absent from the current view's labels.
export const useLabel = (id: string) => {
  const { labels } = useScene();

  const label = useMemo(() => {
    const item = getItemById(labels, id);
    return item ? item.value : null;
  }, [labels, id]);

  return label;
};
