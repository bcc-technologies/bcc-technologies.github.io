import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareEvaluation, evaluate, digest } from './intelligence/evaluation.mjs';
const [command, inputFile, secondFile, outDir] = process.argv.slice(2);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
if (command === 'prepare' && inputFile && secondFile && outDir) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const source = ['signals.mjs', 'relevance.mjs', 'matching.mjs', 'connectors/base.mjs'].map(name => fs.readFileSync(path.join(root, 'intelligence', name), 'utf8'));
  const excluded = read(secondFile);
  const { frozen, review } = prepareEvaluation(read(inputFile), Array.isArray(excluded) ? excluded : excluded.papers.map(p => p.id), digest(source));
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of ['frozen.json', 'review.json']) if (fs.existsSync(path.join(outDir, file))) throw new Error('Usa un directorio nuevo; no sobrescribas una evaluación congelada.');
  fs.writeFileSync(path.join(outDir, 'frozen.json'), JSON.stringify(frozen, null, 2), { flag: 'wx' });
  fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify(review, null, 2), { flag: 'wx' });
  console.log(`Evaluación congelada: ${review.cases.length} documentos. Entrega solamente review.json al revisor.`);
} else if (command === 'report' && inputFile && secondFile) {
  console.log(JSON.stringify(evaluate(read(inputFile), read(secondFile)), null, 2));
} else {
  throw new Error('Uso: node scripts/evaluate-intelligence.mjs prepare corpus.json muestra-usada.json directorio-nuevo | report frozen.json review.json');
}
