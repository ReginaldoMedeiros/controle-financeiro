import { useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { db, type EntryKind } from '../db/db';
import { useAllTransactions, useRecurring } from '../hooks/useData';
import { buildProjection } from '../lib/projection';
import { formatBRL, formatSigned, parseToCents } from '../lib/money';
import { Button, Card, Field, SegmentedControl, Sheet, TextInput } from '../components/ui';

export default function Projection() {
  const transactions = useAllTransactions();
  const recurring = useRecurring();
  const [monthsAhead, setMonthsAhead] = useState(6);
  const [sheetOpen, setSheetOpen] = useState(false);

  const projection = useMemo(
    () => buildProjection(transactions, recurring, { monthsAhead }),
    [transactions, recurring, monthsAhead],
  );

  const chartData = projection.map((p) => ({
    label: p.label,
    saldo: p.balanceCents / 100,
    projected: p.projected,
  }));

  const future = projection.filter((p) => p.projected);
  const totalFutureNet = future.reduce((s, p) => s + p.netCents, 0);
  const endBalance = projection[projection.length - 1]?.balanceCents ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projeção</h1>
        <Button variant="ghost" onClick={() => setSheetOpen(true)}>
          Recorrentes
        </Button>
      </header>

      <p className="text-sm text-slate-400">
        Projeção de superávit/déficit combinando seus lançamentos recorrentes com a média dos últimos meses.
      </p>

      <Field label="Meses à frente">
        <SegmentedControl
          value={String(monthsAhead)}
          onChange={(v) => setMonthsAhead(Number(v))}
          options={[
            { value: '3', label: '3' },
            { value: '6', label: '6' },
            { value: '12', label: '12' },
          ]}
        />
      </Field>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="!p-3 text-center">
          <div className="text-xs text-slate-400">Resultado projetado ({monthsAhead}m)</div>
          <div className={`mt-1 font-bold ${totalFutureNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatSigned(totalFutureNet, totalFutureNet >= 0 ? 'income' : 'expense')}
          </div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-xs text-slate-400">Saldo acumulado ao fim</div>
          <div className={`mt-1 font-bold ${endBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatBRL(endBalance)}
          </div>
        </Card>
      </div>

      {/* Gráfico de saldo acumulado */}
      <Card>
        <h2 className="mb-2 font-semibold">Evolução do saldo</h2>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Tooltip
              formatter={(v: number) => formatBRL(Math.round(v * 100))}
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }}
            />
            <Area type="monotone" dataKey="saldo" stroke="#14b8a6" strokeWidth={2} fill="url(#saldoFill)" />
            <Line type="monotone" dataKey="saldo" stroke="#14b8a6" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Tabela mês a mês */}
      <Card>
        <h2 className="mb-2 font-semibold">Mês a mês</h2>
        <div className="space-y-1">
          {projection.map((p) => (
            <div
              key={p.month}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                p.projected ? 'opacity-70' : ''
              }`}
            >
              <span className="w-16">
                {p.label}
                {p.projected && <span className="ml-1 text-[10px] text-brand-500">prev</span>}
              </span>
              <span className="text-emerald-400/80 text-xs">{formatBRL(p.incomeCents)}</span>
              <span className="text-red-400/80 text-xs">{formatBRL(p.expenseCents)}</span>
              <span className={`w-24 text-right font-medium ${p.netCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatSigned(p.netCents, p.netCents >= 0 ? 'income' : 'expense')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Lançamentos recorrentes">
        <RecurringManager />
      </Sheet>
    </div>
  );
}

function RecurringManager() {
  const recurring = useRecurring();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<EntryKind>('expense');
  const [day, setDay] = useState('5');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseToCents(amount);
    if (!description.trim() || Number.isNaN(cents) || cents === 0) return;
    await db.recurringItems.add({
      description: description.trim(),
      amountCents: Math.abs(cents),
      kind,
      dayOfMonth: Math.min(Math.max(Number(day) || 1, 1), 31),
      active: true,
    });
    setDescription('');
    setAmount('');
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Itens fixos mensais (salário, aluguel, assinaturas...) usados na projeção.
      </p>

      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
        {recurring.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={r.active}
              onChange={(e) => r.id != null && db.recurringItems.update(r.id, { active: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            <div className="flex-1">
              <div className={r.active ? '' : 'line-through text-slate-500'}>{r.description}</div>
              <div className="text-xs text-slate-500">dia {r.dayOfMonth}</div>
            </div>
            <span className={r.kind === 'income' ? 'text-emerald-400' : 'text-red-400'}>
              {formatSigned(r.amountCents, r.kind)}
            </span>
            <button className="text-slate-500" onClick={() => r.id != null && db.recurringItems.delete(r.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="space-y-2 rounded-xl bg-slate-900/50 p-3">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
          ]}
        />
        <TextInput placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <TextInput inputMode="decimal" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextInput inputMode="numeric" placeholder="Dia" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <Button type="submit" className="w-full">+ Adicionar recorrente</Button>
      </form>
    </div>
  );
}
