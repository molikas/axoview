export { Axoview, useAxoview } from './Axoview';
export * from './standaloneExports';
// Agent Control Contract (ADR 0045/0046) — the verb layer + transport helpers both
// the MCP bridge and the app's MCP-connect panel consume. See src/agent/index.ts.
export * from './agent';
export { exportAsJSON } from './utils/exportOptions';
export { stripDefaultIcons, mergeBundledFixtures } from './utils/leanSave';
export { DialogTypeEnum } from './types/ui';
export { default } from './Axoview';
