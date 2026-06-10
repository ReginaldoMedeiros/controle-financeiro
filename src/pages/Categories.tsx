import { useState } from 'react';
import { db, type Category, type EntryKind } from '../db/db';
import { createRuleAndApply } from '../db/operations';
import { useCategories, useRules } from '../hooks/useData';
import { Button, Field, SegmentedControl, Sheet, TextInput } from '../components/ui';

const PALETTE = ['#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#22c55e', '#eab308', '#64748b'];
const ICONS = ['🍽️', '🛒', '🚗', '🏠', '💡', '⚕️', '📚', '🎬', '📺', '🛍️', '👕', '🐾', '🧾', '💰', '💻', '📈', '🎁', '📦'];

export default function Categories() {
  const categories = useCategories();
  const rules = useRules();
  const [kind, setKind] = useState<EntryKind>('expense');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();

  const list = categories.filter((c) => c.kind === kind);

  function openNew() {
    setEditing(undefined);
    setSheetOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setSheetOpen(true);
  }
  async function remove(c: Category) {
    if (c.id == null) return;
    if (confirm(`Excluir a categoria "${c.name}"? Lançamentos ficarão sem categoria.`)) {
      await db.transaction('rw', db.categories, db.categoryRules, db.transactions, async () => {
        await db.categoryRules.where('categoryId').equals(c.id!).delete();
        await db.transactions.where('categoryId').equals(c.id!).modify({ categoryId: undefined });
        await db.categories.delete(c.id!);
      });
    }
  }

  function rulesFor(catId?: number) {
    return rules.filter((r) => r.categoryId === catId).length;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <Button onClick={openNew}>+ Nova</Button>
      </header>

      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
      />

      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-800/50 px-3 py-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: c.color + '33' }}
            >
              {c.icon}
            </div>
            <div className="flex-1" onClick={() => openEdit(c)}>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-slate-400">{rulesFor(c.id)} regra(s) automática(s)</div>
            </div>
            <button className="text-slate-500 px-1" onClick={() => remove(c)}>🗑</button>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Editar categoria' : 'Nova categoria'}>
        <CategoryForm editing={editing} defaultKind={kind} onDone={() => setSheetOpen(false)} />
      </Sheet>
    </div>
  );
}

function CategoryForm({
  editing,
  defaultKind,
  onDone,
}: {
  editing?: Category;
  defaultKind: EntryKind;
  onDone: () => void;
}) {
  const rules = useRules();
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<EntryKind>(editing?.kind ?? defaultKind);
  const [color, setColor] = useState(editing?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(editing?.icon ?? ICONS[0]);
  const [newRule, setNewRule] = useState('');

  const myRules = editing?.id != null ? rules.filter((r) => r.categoryId === editing.id) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing?.id != null) {
      await db.categories.update(editing.id, { name: name.trim(), kind, color, icon });
    } else {
      await db.categories.add({ name: name.trim(), kind, color, icon });
    }
    onDone();
  }

  async function addRule() {
    if (!newRule.trim() || editing?.id == null) return;
    // Cria a regra e a aplica retroativamente aos lançamentos existentes.
    await createRuleAndApply(newRule.trim().toLowerCase(), editing.id, 'contains');
    setNewRule('');
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Nome">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagens" />
      </Field>
      <Field label="Tipo">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
          ]}
        />
      </Field>
      <Field label="Ícone">
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((ic) => (
            <button
              type="button"
              key={ic}
              onClick={() => setIcon(ic)}
              className={`h-9 w-9 rounded-lg text-lg ${icon === ic ? 'bg-brand-600' : 'bg-slate-700/50'}`}
            >
              {ic}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Cor">
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-white' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>

      {editing?.id != null && (
        <div className="rounded-xl bg-slate-900/50 p-3">
          <p className="mb-2 text-sm text-slate-400">
            Regras automáticas — lançamentos cuja descrição contém o texto recebem esta categoria.
          </p>
          <div className="space-y-1 mb-2">
            {myRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-slate-300">contém "{r.pattern}"</span>
                <button
                  type="button"
                  className="text-slate-500"
                  onClick={() => r.id != null && db.categoryRules.delete(r.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <TextInput
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="palavra-chave"
            />
            <Button type="button" variant="ghost" onClick={addRule}>
              + Regra
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full">
        {editing ? 'Salvar' : 'Criar categoria'}
      </Button>
    </form>
  );
}
