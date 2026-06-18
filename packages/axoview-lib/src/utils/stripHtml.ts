/**
 * Reduce rich-text (Quill) HTML to plain text by stripping tags.
 *
 * The single-pass `/<[^>]*>/g` strip duplicated across the canvas/label code is
 * the shape CodeQL flags as `js/incomplete-multi-character-sanitization`: a
 * removal that, in the general case, can leave a tag behind ("may still contain
 * `<script`"). Applying the strip to a fixpoint — repeat until the string stops
 * changing — guarantees no complete `<…>` tag survives, which is the property
 * every caller actually depends on.
 *
 * Every current caller feeds the result to a NON-HTML sink (canvas `fillText`, or
 * a truthiness test that decides whether to render a badge / show a label), so
 * this is defence-in-depth rather than the only guard — but it keeps the strip
 * honest, reusable, and static-analysis-clean.
 */
export const stripHtmlTags = (html: string): string => {
  let out = html;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out;
};
