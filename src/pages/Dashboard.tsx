import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { useAllTransactions, useCategoryMap } from '../hooks/useData';
import { addMonths, currentMonth, monthLabel } from '../lib/dates';
import { formatBRL, formatSigned } from '../lib/money';
import { Card, EmptyState } from '../components/ui';

export default function Dashboard() {
  const all = useAllTransactions();
  const catMap = useCategoryMap();
  const [month, setMonth] = useState(currentMonth());

  const monthTx = useMemo(() => all.filter((t) => t.date.startsWith(month)), [all, month]);

  const kpis = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthTx) {
      if (t.kind === 'income') income += t.amountCents;
      else expense += t.amountCents;
    }
    return { income, expense, balance: income - expense };
  }, [monthTx]);

  // Gastos por categoria (pizza) — só despesas.
  const byCategory = useMemo(() => {
    const map = new Map<string, { value: number; color: string; name: string }>();
    for (const t of monthTx) {
      if (t.kind !== 'expense') continue;
      const cat = t.categoryId != null ? catMap.get(t.categoryId) : undefined;
      const key = cat?.name ?? 'Sem categoria';
      const entry = map.get(key) ?? { value: 0, color: cat?.color ?? '#64748b', name: key };
      entry.value += t.amountCents;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [monthTx, catMap]);

  // Receita x Despesa nos últimos 6 meses (barras).
  const last6 = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(month, -i));
    return months.map((mk) => {
      let income = 0;
      let expense = 0;
      for (const t of all) {
        if (!t.date.startsWith(mk)) continue;
        if (t.kind === 'income') income += t.amountCents;
        else expense += t.amountCents;
      }
      const [, m] = mk.split('-');
      return { label: m, Receitas: income / 100, Despesas: expense / 100 };
    });
  }, [all, month]);

  const hasData = all.length > 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-800/60 px-2 py-1.5">
          <button className="px-3 py-1 text-xl text-slate-400" onClick={() => setMonth(addMonths(month, -1))}>
            ‹
          </button>
          <span className="text-sm font-medium">{monthLabel(month)}</span>
          <button className="px-3 py-1 text-xl text-slate-400" onClick={() => setMonth(addMonths(month, 1))}>
            ›
          </button>
        </div>
      </header>

      {!hasData ? (
        <EmptyState icon="📊" text="Adicione lançamentos ou importe um extrato para ver seus gráficos." />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Card className="!p-3">
              <div className="text-xs text-slate-400">Receitas</div>
              <div className="mt-1 text-sm font-bold text-emerald-400">{formatBRL(kpis.income)}</div>
            </Card>
            <Card className="!p-3">
              <div className="text-xs text-slate-400">Despesas</div>
              <div className="mt-1 text-sm font-bold text-red-400">{formatBRL(kpis.expense)}</div>
            </Card>
            <Card className="!p-3">
              <div className="text-xs text-slate-400">Saldo</div>
              <div className={`mt-1 text-sm font-bold ${kpis.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatSigned(kpis.balance, kpis.balance >= 0 ? 'income' : 'expense')}
              </div>
            </Card>
          </div>

          {/* Pizza por categoria */}
          <Card>
            <h2 className="mb-2 font-semibold">Gastos por categoria</h2>
            {byCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Sem despesas neste mês.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={200} className="max-w-[220px]">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {byCategory.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatBRL(Math.round(v * 100))}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="w-full space-y-1.5 text-sm">
                  {byCategory.slice(0, 6).map((c) => (
                    <li key={c.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="text-slate-300">{formatBRL(c.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Barras receita x despesa */}
          <Card>
            <h2 className="mb-2 font-semibold">Receitas × Despesas (6 meses)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last6}>
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <Tooltip
                  formatter={(v: number) => formatBRL(Math.round(v * 100))}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }}
                  cursor={{ fill: '#ffffff10' }}
                />
                <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
