import { useState } from 'react';
import { type EntryKind, type Transaction, db } from '../db/db';
import { addManualTransaction } from '../db/operations';
import { useAccounts, useCategories } from '../hooks/useData';
import { centsToInput, parseToCents } from '../lib/money';
import { Button, Field, SegmentedControl, Select, TextInput } from './ui';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formulário de criação/edição de lançamento manual. Se `editing` for passado,
 * atualiza a transação existente; senão cria uma nova (com sugestão de categoria).
 */
export default function TransactionForm({
  editing,
  onDone,
}: {
  editing?: Transaction;
  onDone: () => void;
}) {
  const accounts = useAccounts();
  const categories = useCategories();

  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? 'expense');
  const [date, setDate] = useState(editing?.date ?? today());
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(
    editing ? centsToInput(editing.amountCents) : '',
  );
  const [accountId, setAccountId] = useState<number | undefined>(editing?.accountId);
  const [categoryId, setCategoryId] = useState<number | undefined>(editing?.categoryId);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');

  const catOptions = categories.filter((c) => c.kind === kind);
  const effectiveAccount = accountId ?? accounts[0]?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseToCents(amount);
    if (!description.trim()) return setError('Informe uma descrição.');
    if (Number.isNaN(cents) || cents === 0) return setError('Informe um valor válido.');
    if (!effectiveAccount) return setError('Crie uma conta em Ajustes primeiro.');

    const amountCents = Math.abs(cents);
    if (editing?.id != null) {
      await db.transactions.update(editing.id, {
        kind,
        date,
        description: description.trim(),
        amountCents,
        accountId: effectiveAccount,
        categoryId,
        notes: notes.trim() || undefined,
      });
    } else {
      await addManualTransaction({
        kind,
        date,
        description: description.trim(),
        amountCents,
        accountId: effectiveAccount,
        categoryId,
        notes: notes.trim() || undefined,
      });
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <SegmentedControl
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId(undefined);
        }}
        options={[
          { value: 'expense', label: 'Despesa' },
          { value: 'income', label: 'Receita' },
        ]}
      />

      <Field label="Valor">
        <TextInput
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>

      <Field label="Descrição">
        <TextInput
          placeholder="Ex: Mercado, Salário..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Conta">
          <Select
            value={effectiveAccount ?? ''}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Categoria">
        <Select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Sugerir automaticamente</option>
          {catOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Observações (opcional)">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" className="w-full">
        {editing ? 'Salvar alterações' : 'Adicionar'}
      </Button>
    </form>
  );
}
