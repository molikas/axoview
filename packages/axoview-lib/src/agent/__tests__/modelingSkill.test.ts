// Contract ⇄ skill lockstep guard (ADR 0045 §Acceptance: "the modeling skill
// describes exactly the verbs the code ships — no verb in the skill that isn't
// implemented, and apply_intent is absent from the skill until it ships").

import { MODELING_SKILL } from '../modelingSkill';
import { opSchema } from '../opSchemas';

// The op literals the code actually ships, read straight off the discriminated
// union so this test can never drift from the schema.
const shippedOps = [...opSchema.options].map((o) => o.shape.op.value).sort();

describe('modeling skill ⇄ contract lockstep', () => {
  it('describes every shipped apply_ops op', () => {
    for (const op of shippedOps) {
      expect(MODELING_SKILL).toContain(op);
    }
  });

  it('describes the shipped top-level verbs', () => {
    for (const verb of [
      'apply_ops',
      'set_diagram',
      'get_diagram',
      'list_canvases',
      'select_canvas',
      'open_diagram'
    ]) {
      expect(MODELING_SKILL).toContain(verb);
    }
  });

  it('does NOT mention apply_intent (reserved, not shipped)', () => {
    expect(MODELING_SKILL).not.toMatch(/apply_intent/);
  });

  it('does not describe an unimplemented apply_ops op', () => {
    // Any `op: "…"` token appearing in a skill code example must be a shipped op.
    const mentioned = [...MODELING_SKILL.matchAll(/\bop:\s*"([a-z_]+)"/g)].map(
      (m) => m[1]
    );
    for (const op of mentioned) {
      expect(shippedOps).toContain(op);
    }
  });
});
