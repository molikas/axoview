// Whole-content rich-text transforms for the strip's dual-scope format cluster
// (ADR 0034 §2). When a text box is merely SELECTED (no mounted editor), the
// strip formats the whole content by transforming the stored HTML directly —
// a pure DOMParser walk, deliberately NOT a headless Quill instance (Quill
// binds document listeners at import time and drags its runtime into jsdom
// tests for zero gain). Only Quill-whitelisted tags are emitted
// (strong/em/u/s/p/ul/ol/li), so the next live-editor session round-trips the
// result losslessly.

export type InlineFormat = 'bold' | 'italic' | 'underline' | 'strike';
export type ListType = 'bullet' | 'ordered';

// Tags that COUNT as carrying a format when reading (renderer/browser
// synonyms included) vs the single canonical tag written by transforms.
const INLINE_TAGS: Record<InlineFormat, ReadonlySet<string>> = {
  bold: new Set(['STRONG', 'B']),
  italic: new Set(['EM', 'I']),
  underline: new Set(['U']),
  strike: new Set(['S', 'STRIKE', 'DEL'])
};
const CANONICAL_TAG: Record<InlineFormat, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's'
};

const BLOCK_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'PRE',
  'DIV',
  'TABLE',
  'TBODY',
  'THEAD',
  'TR',
  'TD',
  'TH'
]);

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** One `<p>` per line; blank lines keep their height via `<br>`. */
export const plainTextToHtml = (text: string): string =>
  text
    .split('\n')
    .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('');

/**
 * The renderer treats content as HTML only when it starts with `<`
 * (TextBox.tsx). Anything else is plain text and must be escaped before it can
 * be handed to an HTML-based editor or transform.
 */
export const isHtmlContent = (content: string | undefined): boolean =>
  !!content && content.trim().startsWith('<');

export const ensureHtmlContent = (content: string | undefined): string => {
  if (!content) return '';
  return isHtmlContent(content) ? content : plainTextToHtml(content);
};

const parse = (html: string): HTMLElement => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body;
};

/**
 * Leaf blocks are the block elements that directly hold inline content
 * (`<p>`, `<h1>`, `<li>`, …). A body with no block children (bare inline
 * markup) is itself the single leaf.
 */
const collectLeafBlocks = (root: HTMLElement): Element[] => {
  const leaves: Element[] = [];
  const visit = (el: Element) => {
    const blockChildren = Array.from(el.children).filter((c) =>
      BLOCK_TAGS.has(c.tagName)
    );
    if (blockChildren.length === 0) {
      leaves.push(el);
      return;
    }
    blockChildren.forEach(visit);
  };
  visit(root);
  return leaves;
};

const hasVisibleText = (el: Element): boolean =>
  (el.textContent ?? '').trim().length > 0;

/** Every non-whitespace text node in `leaf` sits under a format-carrying tag. */
const leafFullyFormatted = (leaf: Element, format: InlineFormat): boolean => {
  const tags = INLINE_TAGS[format];
  const doc = leaf.ownerDocument;
  const walker = doc.createTreeWalker(leaf, NodeFilter.SHOW_TEXT);
  let covered = true;
  let sawText = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node.textContent ?? '').trim()) continue;
    sawText = true;
    let ancestor: Element | null = node.parentElement;
    let wrapped = false;
    while (ancestor && ancestor !== leaf.parentElement) {
      if (tags.has(ancestor.tagName)) {
        wrapped = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!wrapped) {
      covered = false;
      break;
    }
  }
  return sawText && covered;
};

export interface WholeContentFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** The list type when EVERY line is a list item of that one type. */
  list: ListType | null;
}

/**
 * Formats that apply to the ENTIRE content — drives the strip's pressed state
 * for a selected (non-editing) text box: pressed iff the whole content carries
 * the format.
 */
export const getWholeContentFormats = (
  content: string | undefined
): WholeContentFormats => {
  const none: WholeContentFormats = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    list: null
  };
  if (!content || !content.trim()) return none;
  const body = parse(ensureHtmlContent(content));
  if (!hasVisibleText(body)) return none;
  const leaves = collectLeafBlocks(body).filter(hasVisibleText);
  if (leaves.length === 0) return none;

  const all = (format: InlineFormat) =>
    leaves.every((leaf) => leafFullyFormatted(leaf, format));

  const topBlocks = Array.from(body.children).filter((c) =>
    BLOCK_TAGS.has(c.tagName)
  );
  let list: ListType | null = null;
  if (topBlocks.length > 0) {
    if (topBlocks.every((b) => b.tagName === 'UL')) list = 'bullet';
    else if (topBlocks.every((b) => b.tagName === 'OL')) list = 'ordered';
  }

  return {
    bold: all('bold'),
    italic: all('italic'),
    underline: all('underline'),
    strike: all('strike'),
    list
  };
};

/**
 * Apply or remove one inline format across the whole content. Applying wraps
 * each leaf block's children in the canonical tag (skipping already-covered
 * leaves); removing unwraps every synonym tag.
 */
export const applyInlineFormat = (
  content: string | undefined,
  format: InlineFormat,
  on: boolean
): string => {
  const html = ensureHtmlContent(content);
  if (!html) return html;
  const body = parse(html);
  const doc = body.ownerDocument;

  if (on) {
    collectLeafBlocks(body).forEach((leaf) => {
      if (!hasVisibleText(leaf) || leafFullyFormatted(leaf, format)) return;
      const wrapper = doc.createElement(CANONICAL_TAG[format]);
      while (leaf.firstChild) wrapper.appendChild(leaf.firstChild);
      leaf.appendChild(wrapper);
    });
  } else {
    const tags = INLINE_TAGS[format];
    // Unwrap repeatedly — nested same-format wrappers unwrap one level per pass.
    let match: Element | null;
    const find = () =>
      Array.from(body.querySelectorAll('*')).find((el) =>
        tags.has(el.tagName)
      ) ?? null;
    while ((match = find())) {
      const parent = match.parentNode;
      if (!parent) break;
      while (match.firstChild) parent.insertBefore(match.firstChild, match);
      parent.removeChild(match);
    }
  }
  return body.innerHTML;
};

/**
 * Convert the whole content to one list of `type` (each current line — block
 * or list item — becomes an `<li>`, keeping its inline formatting), or unwrap
 * every list back to paragraphs when `on` is false.
 */
export const applyListFormat = (
  content: string | undefined,
  type: ListType,
  on: boolean
): string => {
  const html = ensureHtmlContent(content);
  if (!html) return html;
  const body = parse(html);
  const doc = body.ownerDocument;

  if (on) {
    // Flatten the current structure into "lines" (leaf blocks in order), then
    // rebuild as a single list. Headers flatten into plain items (the block
    // format is replaced, like Quill's own line format would).
    const lines = collectLeafBlocks(body).filter(
      (leaf) => hasVisibleText(leaf) || leaf.querySelector('br')
    );
    const listEl = doc.createElement(type === 'bullet' ? 'ul' : 'ol');
    if (lines.length === 0) {
      const li = doc.createElement('li');
      while (body.firstChild) li.appendChild(body.firstChild);
      listEl.appendChild(li);
    } else {
      lines.forEach((line) => {
        const li = doc.createElement('li');
        while (line.firstChild) li.appendChild(line.firstChild);
        listEl.appendChild(li);
      });
    }
    body.innerHTML = '';
    body.appendChild(listEl);
  } else {
    // Every <li> anywhere becomes a <p>; list containers dissolve in place.
    Array.from(body.querySelectorAll('li')).forEach((li) => {
      const p = doc.createElement('p');
      while (li.firstChild) p.appendChild(li.firstChild);
      li.replaceWith(p);
    });
    Array.from(body.querySelectorAll('ul, ol')).forEach((listEl) => {
      const parent = listEl.parentNode;
      if (!parent) return;
      while (listEl.firstChild) parent.insertBefore(listEl.firstChild, listEl);
      parent.removeChild(listEl);
    });
  }
  return body.innerHTML;
};
