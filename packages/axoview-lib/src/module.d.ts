declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

// Side-effect stylesheet imports (GlobalStyles.tsx); rslib emits styles.css.
// TS 6 checks side-effect imports by default (noUncheckedSideEffectImports).
declare module '*.css';
