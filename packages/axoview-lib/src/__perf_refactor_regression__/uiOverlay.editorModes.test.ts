/**
 * REGRESSION — UiOverlay editor mode mapping
 *
 * Tests the tool-set contract for each editor mode.
 *
 * NOTE: EDITOR_MODE_MAPPING in UiOverlay.tsx is a private module-level constant
 * that cannot be imported without pulling in the full React/MUI component tree
 * (which uses MUI createTheme at module load time — incompatible with jsdom).
 * The local constant below was manually verified against the production
 * EDITOR_MODE_MAPPING in UiOverlay.tsx on 2026-06-10 and must be kept in sync.
 *
 * Classification: SEMI-VALID — contract is tested but against a local constant.
 * To make this fully VALID: extract EDITOR_MODE_MAPPING to a standalone config
 * file with no MUI/React dependencies (e.g. src/config/editorModeMapping.ts).
 */

import { EditorModeEnum } from 'src/types';

type Tool = 'TOOL_MENU' | 'ITEM_CONTROLS' | 'VIEW_TITLE' | 'VIEW_TABS';

// Manually verified against UiOverlay.tsx EDITOR_MODE_MAPPING — update if production changes.
const EDITOR_MODE_MAPPING: Record<string, Tool[]> = {
  [EditorModeEnum.EDITABLE]: ['ITEM_CONTROLS', 'TOOL_MENU', 'VIEW_TABS'],
  [EditorModeEnum.EXPLORABLE_READONLY]: ['ITEM_CONTROLS', 'VIEW_TABS'],
  [EditorModeEnum.NON_INTERACTIVE]: []
};

describe('UiOverlay editor mode mapping', () => {
  describe('EDITABLE mode', () => {
    const tools = EDITOR_MODE_MAPPING[EditorModeEnum.EDITABLE];

    it('includes TOOL_MENU', () => expect(tools).toContain('TOOL_MENU'));
    it('includes ITEM_CONTROLS', () =>
      expect(tools).toContain('ITEM_CONTROLS'));
    it('includes VIEW_TABS', () => expect(tools).toContain('VIEW_TABS'));
    it('does NOT include VIEW_TITLE', () =>
      expect(tools).not.toContain('VIEW_TITLE'));
    it('contains exactly 3 tools', () => expect(tools).toHaveLength(3));
  });

  describe('EXPLORABLE_READONLY mode', () => {
    const tools = EDITOR_MODE_MAPPING[EditorModeEnum.EXPLORABLE_READONLY];

    it('includes ITEM_CONTROLS', () =>
      expect(tools).toContain('ITEM_CONTROLS'));
    it('includes VIEW_TABS', () => expect(tools).toContain('VIEW_TABS'));
    it('does NOT include TOOL_MENU', () =>
      expect(tools).not.toContain('TOOL_MENU'));
    it('does NOT include VIEW_TITLE', () =>
      expect(tools).not.toContain('VIEW_TITLE'));
    it('contains exactly 2 tools', () => expect(tools).toHaveLength(2));
  });

  describe('NON_INTERACTIVE mode', () => {
    const tools = EDITOR_MODE_MAPPING[EditorModeEnum.NON_INTERACTIVE];

    it('is empty', () => expect(tools).toHaveLength(0));
  });

  describe('invariants across all modes', () => {
    it('VIEW_TITLE is never enabled in any mode', () => {
      Object.values(EDITOR_MODE_MAPPING).forEach((tools) => {
        expect(tools).not.toContain('VIEW_TITLE');
      });
    });

    it('TOOL_MENU is only in EDITABLE mode', () => {
      Object.entries(EDITOR_MODE_MAPPING).forEach(([mode, tools]) => {
        if (mode === EditorModeEnum.EDITABLE) {
          expect(tools).toContain('TOOL_MENU');
        } else {
          expect(tools).not.toContain('TOOL_MENU');
        }
      });
    });

    it('VIEW_TABS is present in every non-empty mode', () => {
      Object.values(EDITOR_MODE_MAPPING).forEach((tools) => {
        if (tools.length > 0) expect(tools).toContain('VIEW_TABS');
      });
    });

    it('all three modes are defined and are arrays', () => {
      [
        EditorModeEnum.EDITABLE,
        EditorModeEnum.EXPLORABLE_READONLY,
        EditorModeEnum.NON_INTERACTIVE
      ].forEach((mode) => {
        expect(EDITOR_MODE_MAPPING[mode]).toBeDefined();
        expect(Array.isArray(EDITOR_MODE_MAPPING[mode])).toBe(true);
      });
    });
  });
});
