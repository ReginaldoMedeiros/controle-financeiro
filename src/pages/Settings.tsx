import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, type AccountType } from '../db/db';
import { useAccounts } from '../hooks/useData';
import { downloadBackup, importBackup } from '../db/backup';
import { Button, Card, Field, SegmentedControl, Sheet, TextInput } from '../components/ui';

export default function Settings() {
  const accounts = useAccounts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountSheet, setAccountSheet] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [status, setStatus] = useState('');

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await db.accounts.add({ name: name.trim(), type });
    setName('');
    setAccountSheet(false);
  }

  async function removeAccount(id?: number) {
    if (id == null) return;
    const count = await db.transactions.where('accountId').equals(id).count();
    if (count > 0) {
      alert(`Esta conta tem ${count} lançamento(s). Exclua ou mova-os antes.`);
      return;
    }
    if (confirm('Excluir esta conta?')) await db.accounts.delete(id);
  }

  async function handleImport(file: File, mode: 'replace' | 'merge') {
    try {
      const json = JSON.parse(await file.text());
      const { imported } = await importBackup(json, mode);
      setStatus(`✅ ${imported} lançamentos importados do backup.`);
    } catch {
      setStatus('❌ Arquivo de backup inválido.');
    }
  }

  async function clearAll() {
    if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
    if (!confirm('Tem certeza? Faça um backup antes!')) return;
    await Promise.all([
      db.transactions.clear(),
      db.importBatches.clear(),
      db.recurringItems.clear(),
    ]);
    setStatus('Todos os lançamentos foram apagados.');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      {status && (
        <div className="rounded-xl bg-slate-800/60 px-3 py-2 text-sm">{status}</div>
      )}

      {/* Contas */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Contas e cartões</h2>
          <Button variant="ghost" onClick={() => setAccountSheet(true)}>
            + Nova
          </Button>
        </div>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2">
              <span>
                {a.type === 'credit' ? '💳' : '🏦'} {a.name}
              </span>
              <button className="text-slate-500" onClick={() => removeAccount(a.id)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Categorias */}
      <Card>
        <Link to="/categories" className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Categorias e regras</h2>
            <p className="text-sm text-slate-400">Gerencie categorias e a categorização automática</p>
          </div>
          <span className="text-slate-500 text-xl">›</span>
        </Link>
      </Card>

      {/* Backup */}
      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">Backup do histórico</h2>
          <p className="text-sm text-slate-400">
            Seus dados ficam só neste dispositivo. Exporte periodicamente para não perder o histórico.
          </p>
        </div>
        <Button onClick={() => downloadBackup()} className="w-full">
          ⬇️ Exportar backup (.json)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const mode = confirm(
              'OK = Substituir todos os dados pelo backup.\nCancelar = Mesclar com os dados atuais.',
            )
              ? 'replace'
              : 'merge';
            handleImport(f, mode);
            e.target.value = '';
          }}
        />
        <Button variant="ghost" onClick={() => fileRef.current?.click()} className="w-full">
          ⬆️ Restaurar / importar backup
        </Button>
      </Card>

      {/* Zona de perigo */}
      <Card className="border-red-500/30">
        <h2 className="mb-2 font-semibold text-red-400">Zona de perigo</h2>
        <Button variant="danger" onClick={clearAll} className="w-full">
          Apagar todos os lançamentos
        </Button>
      </Card>

      <p className="pb-4 text-center text-xs text-slate-600">
        Controle Financeiro · roda 100% no seu dispositivo
      </p>

      <Sheet open={accountSheet} onClose={() => setAccountSheet(false)} title="Nova conta">
        <form onSubmit={addAccount} className="space-y-3">
          <Field label="Nome">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Carteira..." />
          </Field>
          <Field label="Tipo">
            <SegmentedControl
              value={type}
              onChange={setType}
              options={[
                { value: 'checking', label: 'Conta' },
                { value: 'credit', label: 'Cartão' },
              ]}
            />
          </Field>
          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
