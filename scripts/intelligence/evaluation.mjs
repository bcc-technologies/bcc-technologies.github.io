import { createHash } from 'node:crypto';
import { generateStrategicSignals } from './signals.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Freeze predictions before requesting labels. Keep labels separate so the
// reviewer can judge the papers without seeing the model's selection.
export function prepareEvaluation(context, excludedIds, engineHash) {
  if (!Array.isArray(context.papers) || !context.papers.length || !Number.isFinite(context.now)) throw new Error('Se requieren papers y una fecha de corte fija.');
  const ids = context.papers.map(p => p.id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('IDs vacíos o duplicados.');
  if (ids.some(id => excludedIds.includes(id))) throw new Error('Hay documentos usados para ajustar las reglas. No es una muestra independiente.');
  if (!engineHash) throw new Error('Falta la huella del motor.');
  const frozenContext = { ...context, coverage: { ...context.coverage, temporallyRepresentative: false } };
  const predictions = generateStrategicSignals(frozenContext);
  const selectedIds = [...new Set(predictions.flatMap(s => s.evidenceRefs.filter(r => r.type === 'paper').map(r => r.id)))];
  const frozen = { schemaVersion: 1, engineHash, context: frozenContext, excludedIdsHash: digest([...excludedIds].sort()), predictions, selectedIds };
  return {
    frozen,
    review: { schemaVersion: 1, frozenHash: digest(frozen), rubric: '¿Este paper justifica un próximo paso concreto de BCC/MAP-Nano? yes/no/uncertain. Explica el problema, aporte de BCC y prueba o descarte; no puntúes sólo afinidad temática.',
      cases: context.papers.map(p => ({ id: p.id, title: p.title, abstract: p.abstract, url: p.sourceUrl, useful: null, reason: '', reviewer: '' })) }
  };
}

export function evaluate(frozen, review) {
  if (review.frozenHash !== digest(frozen)) throw new Error('El corpus o las predicciones cambiaron después de congelar la muestra.');
  const ids = new Set(frozen.context.papers.map(p => p.id));
  const cases = review.cases || [];
  if (cases.length !== ids.size || new Set(cases.map(c => c.id)).size !== ids.size || cases.some(c => !ids.has(c.id))) throw new Error('La revisión no coincide con el corpus completo.');
  if (cases.some(c => ![null, 'yes', 'no', 'uncertain'].includes(c.useful))) throw new Error('Etiqueta inválida.');
  const pending = cases.filter(c => c.useful === null || !c.reason?.trim() || !c.reviewer?.trim()).length;
  const uncertain = cases.filter(c => c.useful === 'uncertain').length;
  const selected = new Set(frozen.selectedIds);
  const report = { papers: ids.size, selected: selected.size, pending, uncertain, ready: pending === 0 && uncertain === 0,
    precision: null, recallWithinSample: null, truePositive: null, falsePositive: null, falseNegative: null,
    limitation: 'Mide utilidad de papers seleccionados dentro de esta muestra, no éxito comercial, calidad de fichas ni recall del universo científico.' };
  if (!report.ready) return report;
  const tp = cases.filter(c => c.useful === 'yes' && selected.has(c.id)).length;
  const fp = cases.filter(c => c.useful === 'no' && selected.has(c.id)).length;
  const fn = cases.filter(c => c.useful === 'yes' && !selected.has(c.id)).length;
  return { ...report, truePositive: tp, falsePositive: fp, falseNegative: fn,
    precision: tp + fp ? tp / (tp + fp) : null, recallWithinSample: tp + fn ? tp / (tp + fn) : null };
}
