import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEvaluation, evaluate, digest } from '../scripts/intelligence/evaluation.mjs';
const context = { now: Date.parse('2026-09-07'), papers: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], topics: [] };
test('evaluation rejects reused documents and repeated IDs', () => {
  assert.throws(() => prepareEvaluation(context, ['a'], 'hash'), /independiente/);
  assert.throws(() => prepareEvaluation({ ...context, papers: [context.papers[0], context.papers[0]] }, [], 'hash'), /duplicados/);
});
test('evaluation does not invent precision from pending or uncertain human labels', () => {
  const { frozen, review } = prepareEvaluation(context, [], 'hash');
  assert.equal(evaluate(frozen, review).precision, null);
  review.cases.forEach(c => Object.assign(c, { useful: 'uncertain', reason: 'Falta evidencia', reviewer: 'Persona' }));
  assert.equal(evaluate(frozen, review).ready, false);
});
test('evaluation verifies the immutable corpus and accounts for missed useful papers', () => {
  const { frozen, review } = prepareEvaluation(context, [], 'hash');
  frozen.selectedIds = ['a']; review.frozenHash = digest(frozen);
  review.cases.forEach(c => Object.assign(c, { useful: 'yes', reason: 'Prueba concreta', reviewer: 'Persona' }));
  assert.equal(evaluate(frozen, review).precision, 1);
  assert.equal(evaluate(frozen, review).recallWithinSample, .5);
  frozen.context.papers[0].title = 'Changed';
  assert.throws(() => evaluate(frozen, review), /cambiaron/);
});
