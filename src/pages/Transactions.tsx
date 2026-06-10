import { useMemo, useState } from 'react';
import { db, type Transaction } from '../db/db';
import { useAllTransactions, useCategoryMap } from '../hooks/useData';
import { addMonths, currentMonth, formatDayMonth, monthLabel } from '../lib/dates';
import { formatSigned } from '../lib/money';
import TransactionForm from '../components/TransactionForm';
import { Button, Card, EmptyState, Sheet, TextInput } from '../components/ui';

export default function Transactions() {
  const all = useAllTransactions();
  const catMap = useCategoryMap();
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (!t.date.startsWith(month)) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, month, search]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.kind === 'income') income += t.amountCents;
      else expense += t.amountCents;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  function openNew() {
    setEditing(undefined);
    setSheetOpen(true);
  }
  function openEdit(t: Transaction) {
    setEditing(t);
    setSheetOpen(true);
  }
  async function remove(t: Transaction) {
    if (t.id != null && confirm('Excluir este lançamento?')) {
      await db.transactions.delete(t.id);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <Button onClick={openNew}>+ Novo</Button>
      </header>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl bg-slate-800/60 px-2 py-1.5">
        <button className="px-3 py-1 text-xl text-slate-400" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <span className="text-sm font-medium">{monthLabel(month)}</span>
        <button className="px-3 py-1 text-xl text-slate-400" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="!p-3">
          <div className="text-xs text-slate-400">Receitas</div>
          <div className="text-emerald-400 font-semibold text-sm">{formatSigned(totals.income, 'income')}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-400">Despesas</div>
          <div className="text-red-400 font-semibold text-sm">{formatSigned(totals.expense, 'expense')}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-400">Saldo</div>
          <div className={`font-semibold text-sm ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatSigned(totals.net, totals.net >= 0 ? 'income' : 'expense')}
          </div>
        </Card>
      </div>

      <TextInput
        placeholder="🔍 Buscar lançamento..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState icon="🗒️" text="Nenhum lançamento neste mês." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const cat = t.categoryId != null ? catMap.get(t.categoryId) : undefined;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl bg-slate-800/50 px-3 py-2.5"
                onClick={() => openEdit(t)}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: (cat?.color ?? '#475569') + '33' }}
                >
                  {cat?.icon ?? '❓'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.description}</div>
                  <div className="text-xs text-slate-400">
                    {formatDayMonth(t.date)} · {cat?.name ?? 'Sem categoria'}
                    {t.source === 'import' && ' · importado'}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${t.kind === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatSigned(t.amountCents, t.kind)}
                </div>
                <button
                  className="text-slate-500 px-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(t);
                  }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      >
        <TransactionForm editing={editing} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}
