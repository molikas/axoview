import { generateId } from './common';

type RawObject = Record<string, unknown>;

const isObj = (v: unknown): v is RawObject =>
  typeof v === 'object' && v !== null;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : undefined;
const bool = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : undefined;

// Inline legacy-label migration (mirrors utils/connectorLabels.migrateLegacyLabels)
// but on a raw pre-validation object, so an already-labelled connector keeps its
// migrated content when we prepend the seeded name label.
const migrateLegacy = (c: RawObject): RawObject[] => {
  const out: RawObject[] = [];
  if (str(c.startLabel))
    out.push({
      id: generateId(),
      text: c.startLabel,
      position: 10,
      height: num(c.startLabelHeight),
      line: '1'
    });
  if (str(c.description))
    out.push({
      id: generateId(),
      text: c.description,
      position: 50,
      height: num(c.centerLabelHeight),
      line: '1'
    });
  if (str(c.endLabel))
    out.push({
      id: generateId(),
      text: c.endLabel,
      position: 90,
      height: num(c.endLabelHeight),
      line: '1'
    });
  return out;
};

/**
 * ADR 0032 connector amendment (2026-07-02) — connector name↔label decouple seed.
 *
 * Mirrors seedNodeLabel. Before the decouple a connector's `name` was drawn on
 * canvas as a synthetic midpoint label. Now the on-canvas text is the
 * connector's `labels[]`; `name` is identity-only (Layers-renamed, never drawn).
 * On load we fold each existing connector's `name` into a `labels[]` entry — at
 * its former `nameLabel*` placement/style — so saved diagrams keep their visible
 * text, then mark the connector `nameSeeded: true`.
 *
 * The marker is set on EVERY connector the pass touches (name present or not),
 * so the connector is stamped as living in the decoupled model. That makes the
 * seed idempotent (re-run = no-op) AND means a name later typed in Layers is
 * pure identity — it is never re-seeded into a canvas label on a subsequent load.
 *
 * Pure + idempotent. Safe to map over each view's connectors on load, right
 * after the node seedNodeLabel pass.
 */
export const seedConnectorLabel = (connector: unknown): unknown => {
  if (!isObj(connector)) return connector;
  if (connector.nameSeeded === true) return connector;

  const name = str(connector.name);
  if (!name) return { ...connector, nameSeeded: true };

  const nameLabel: RawObject = {
    id: generateId(),
    text: name,
    position: num(connector.nameLabelPosition) ?? 50,
    height: num(connector.nameLabelHeight) ?? 0,
    line: '1',
    fontSize: num(connector.nameLabelFontSize),
    labelColor:
      typeof connector.nameLabelColor === 'string'
        ? connector.nameLabelColor
        : undefined,
    bold: bool(connector.nameLabelBold),
    italic: bool(connector.nameLabelItalic),
    strikethrough: bool(connector.nameLabelStrikethrough)
  };

  const base = Array.isArray(connector.labels)
    ? (connector.labels as RawObject[])
    : migrateLegacy(connector);

  return {
    ...connector,
    labels: [nameLabel, ...base],
    nameSeeded: true,
    // Legacy fields are now folded into labels[] — drop them so getConnectorLabels
    // reads labels[] cleanly (leanSave omits undefined).
    description: undefined,
    startLabel: undefined,
    endLabel: undefined,
    startLabelHeight: undefined,
    centerLabelHeight: undefined,
    endLabelHeight: undefined
  };
};
