import assert from 'node:assert';
import { parseToCents, formatBRL, centsToInput } from '../src/lib/money.ts';
import { normalizeDate } from '../src/lib/parsers/types.ts';
import { parseCsvRaw, guessMapping, applyMapping } from '../src/lib/parsers/csv.ts';
import { txHash } from '../src/lib/hash.ts';
import { buildProjection } from '../src/lib/projection.ts';
import { suggestCategory } from '../src/lib/categorize.ts';

let pass = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  pass++;
};

// --- money ---
ok(parseToCents('1.234,56') === 123456, 'BR format');
ok(parseToCents('1234.56') === 123456, 'dot decimal');
ok(parseToCents('R$ 50,00') === 5000, 'currency symbol');
ok(parseToCents('-12,30') === -1230, 'negative');
ok(parseToCents('1.000') === 100000, 'thousands no decimals');
ok(Number.isNaN(parseToCents('abc')), 'invalid -> NaN');
ok(centsToInput(123456) === '1234,56', 'centsToInput');
ok(formatBRL(123456).includes('1.234,56'), 'formatBRL');

// --- dates ---
ok(normalizeDate('05/03/2025') === '2025-03-05', 'dd/mm/yyyy');
ok(normalizeDate('5/3/25') === '2025-03-05', 'dd/mm/yy');
ok(normalizeDate('2025-03-05') === '2025-03-05', 'iso');
ok(normalizeDate('12 jan 2024') === '2024-01-12', 'textual month');
ok(normalizeDate('12 jan', 2023) === '2023-01-12', 'textual fallback year');
ok(normalizeDate('xx') === null, 'invalid date');

// --- csv ---
const csv = 'Data;Descrição;Valor\n05/03/2025;IFOOD RESTAURANTE;-45,90\n06/03/2025;SALARIO;3000,00';
const { headers, rows } = parseCsvRaw(csv);
const map = guessMapping(headers);
ok(map.dateCol === 'Data' && map.descCol === 'Descrição' && map.amountCol === 'Valor', 'guess mapping');
const res = applyMapping(rows, { ...map, amountMode: 'signed' });
ok(res.rows.length === 2, 'csv rows');
ok(res.rows[0].kind === 'expense' && res.rows[0].amountCents === 4590, 'csv expense');
ok(res.rows[1].kind === 'income' && res.rows[1].amountCents === 300000, 'csv income');

// --- hash dedupe determinism ---
const h1 = txHash({ date: '2025-03-05', amountCents: -4590, description: 'IFOOD', accountId: 1 });
const h2 = txHash({ date: '2025-03-05', amountCents: -4590, description: 'ifood ', accountId: 1 });
ok(h1 === h2, 'hash normalizes desc');

// --- categorize ---
const cats = [
  { id: 1, name: 'Alimentação', kind: 'expense', color: '', icon: '' },
  { id: 2, name: 'Salário', kind: 'income', color: '', icon: '' },
];
const rules = [
  { id: 1, pattern: 'ifood', matchType: 'contains', categoryId: 1, priority: 10 },
  { id: 2, pattern: 'salario', matchType: 'contains', categoryId: 2, priority: 10 },
];
ok(suggestCategory('IFOOD RESTAURANTE', 'expense', rules, cats) === 1, 'categorize ifood');
ok(suggestCategory('SALARIO EMPRESA', 'income', rules, cats) === 2, 'categorize salario');
ok(suggestCategory('IFOOD', 'income', rules, cats) === undefined, 'kind mismatch -> none');

// --- projection ---
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const txs = [
  { date: `${thisMonth}-10`, amountCents: 300000, kind: 'income', accountId: 1, source: 'manual', hash: 'a' },
  { date: `${thisMonth}-12`, amountCents: 100000, kind: 'expense', accountId: 1, source: 'manual', hash: 'b' },
];
const recurring = [
  { description: 'Salário', amountCents: 300000, kind: 'income', dayOfMonth: 5, active: true },
  { description: 'Aluguel', amountCents: 150000, kind: 'expense', dayOfMonth: 10, active: true },
];
const proj = buildProjection(txs, recurring, { monthsAhead: 3 });
ok(proj.length >= 4, 'projection months');
const future = proj.filter((p) => p.projected);
ok(future.length === 3, 'three future months');
ok(future[0].incomeCents === 300000 && future[0].expenseCents === 150000, 'future uses recurring');
ok(future[0].netCents === 150000, 'future net = superavit');

console.log(`\n✅ ${pass} asserções passaram.`);
