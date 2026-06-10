import { type Transaction, type RecurringItem } from '../db/db';

export interface MonthProjection {
  /** 'YYYY-MM' */
  month: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  /** receita - despesa do mês (superávit se > 0, déficit se < 0). */
  netCents: number;
  /** saldo acumulado a partir do saldo inicial. */
  balanceCents: number;
  /** true se o mês é projetado (futuro), false se é histórico real. */
  projected: boolean;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function labelFor(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]}/${String(y).slice(2)}`;
}

/**
 * Projeta receitas/despesas e saldo acumulado.
 *
 * - Meses passados e o mês corrente usam os lançamentos reais.
 * - Meses futuros combinam:
 *     a) itens recorrentes ativos (valor fixo mensal), e
 *     b) média móvel das despesas/receitas variáveis dos últimos `lookback` meses
 *        (parte não coberta pelos recorrentes), para refletir gastos típicos.
 *
 * Retorna uma série contínua de meses, do mais antigo com dados até
 * `monthsAhead` meses no futuro.
 */
export function buildProjection(
  transactions: Transaction[],
  recurring: RecurringItem[],
  opts: { monthsAhead?: number; lookback?: number; startingBalanceCents?: number } = {},
): MonthProjection[] {
  const monthsAhead = opts.monthsAhead ?? 6;
  const lookback = opts.lookback ?? 3;
  const startingBalance = opts.startingBalanceCents ?? 0;

  // Agrega histórico por mês.
  const hist = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    const key = t.date.slice(0, 7); // YYYY-MM
    const agg = hist.get(key) ?? { income: 0, expense: 0 };
    if (t.kind === 'income') agg.income += t.amountCents;
    else agg.expense += t.amountCents;
    hist.set(key, agg);
  }

  const now = new Date();
  const currentKey = monthKey(now);

  // Determina o primeiro mês exibido (mais antigo entre histórico e 1 ano atrás máx).
  const histKeys = [...hist.keys()].sort();
  const firstKey = histKeys[0] ?? currentKey;

  // Recorrentes mensais fixos.
  const recurIncome = recurring
    .filter((r) => r.active && r.kind === 'income')
    .reduce((s, r) => s + r.amountCents, 0);
  const recurExpense = recurring
    .filter((r) => r.active && r.kind === 'expense')
    .reduce((s, r) => s + r.amountCents, 0);

  // Média móvel das despesas/receitas dos últimos `lookback` meses já fechados
  // (exclui o mês corrente, que pode estar incompleto).
  const closedKeys = histKeys.filter((k) => k < currentKey).slice(-lookback);
  const avg = closedKeys.reduce(
    (acc, k) => {
      const h = hist.get(k)!;
      acc.income += h.income;
      acc.expense += h.expense;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const n = Math.max(closedKeys.length, 1);
  const avgIncome = Math.round(avg.income / n);
  const avgExpense = Math.round(avg.expense / n);

  // Para meses futuros usamos o MAIOR entre os recorrentes e a média histórica,
  // assim a projeção nunca ignora gastos variáveis típicos nem recorrentes.
  const projIncome = Math.max(recurIncome, avgIncome);
  const projExpense = Math.max(recurExpense, avgExpense);

  // Monta a sequência de meses.
  const result: MonthProjection[] = [];
  let cursor = new Date(Number(firstKey.slice(0, 4)), Number(firstKey.slice(5, 7)) - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  let balance = startingBalance;

  while (cursor <= end) {
    const key = monthKey(cursor);
    const isFuture = key > currentKey;
    let income: number;
    let expense: number;

    if (isFuture) {
      income = projIncome;
      expense = projExpense;
    } else {
      const h = hist.get(key) ?? { income: 0, expense: 0 };
      income = h.income;
      expense = h.expense;
    }

    const net = income - expense;
    balance += net;
    result.push({
      month: key,
      label: labelFor(key),
      incomeCents: income,
      expenseCents: expense,
      netCents: net,
      balanceCents: balance,
      projected: isFuture,
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return result;
}
