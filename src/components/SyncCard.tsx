import { useState } from 'react';
import {
  checkRepo,
  clearConfig,
  getConfig,
  getState,
  pullNow,
  pushNow,
  reconcile,
  setConfig,
  type SyncConfig,
} from '../db/sync';
import { Button, Card, Field, TextInput } from './ui';

export default function SyncCard() {
  const [cfg, setCfg] = useState<SyncConfig | null>(getConfig());
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [, force] = useState(0);

  const state = getState();

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const [owner, repoName] = repo.split('/').map((s) => s.trim());
    if (!owner || !repoName) return setMsg('Informe no formato usuario/repositorio.');
    if (!token.trim()) return setMsg('Cole o token de acesso.');

    const newCfg: SyncConfig = {
      token: token.trim(),
      owner,
      repo: repoName,
      path: 'financas.json',
      branch: branch.trim() || 'main',
      auto,
    };

    setBusy(true);
    try {
      await checkRepo(newCfg);
      setConfig(newCfg);
      await reconcile(); // sincronização inicial (baixa ou envia)
      setCfg(newCfg);
      const st = getState();
      setMsg(st.lastError ? `⚠️ ${st.lastError}` : `✅ Conectado. ${st.lastResult ?? ''}`);
    } catch (err) {
      setMsg(`❌ ${err instanceof Error ? err.message : 'Falha ao conectar.'}`);
    } finally {
      setBusy(false);
    }
  }

  async function doPush() {
    setBusy(true);
    setMsg('');
    try {
      await pushNow();
      setMsg(`✅ ${getState().lastResult ?? 'Enviado.'}`);
    } catch (err) {
      setMsg(`❌ ${err instanceof Error ? err.message : 'Falha ao enviar.'}`);
    } finally {
      setBusy(false);
      force((n) => n + 1);
    }
  }

  async function doPull() {
    if (!confirm('Baixar os dados do GitHub e substituir os deste dispositivo?')) return;
    setBusy(true);
    setMsg('');
    try {
      await pullNow();
      setMsg(`✅ ${getState().lastResult ?? 'Baixado.'}`);
    } catch (err) {
      setMsg(`❌ ${err instanceof Error ? err.message : 'Falha ao baixar.'}`);
    } finally {
      setBusy(false);
      force((n) => n + 1);
    }
  }

  function toggleAuto() {
    if (!cfg) return;
    const next = { ...cfg, auto: !cfg.auto };
    setConfig(next);
    setCfg(next);
  }

  function disconnect() {
    if (!confirm('Desconectar a sincronização? Os dados continuam neste dispositivo.')) return;
    clearConfig();
    setCfg(null);
    setMsg('');
  }

  if (cfg) {
    return (
      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">☁️ Sincronização (GitHub)</h2>
          <p className="text-sm text-slate-400">
            Conectado a <span className="font-mono">{cfg.owner}/{cfg.repo}</span>
          </p>
        </div>

        <div className="rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
          {state.lastError ? (
            <span className="text-red-400">⚠️ {state.lastError}</span>
          ) : (
            <span className="text-slate-300">{state.lastResult ?? 'Sincronizado.'}</span>
          )}
        </div>

        <label className="flex items-center justify-between text-sm">
          <span>Sincronização automática</span>
          <input
            type="checkbox"
            checked={cfg.auto}
            onChange={toggleAuto}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        {msg && <p className="text-sm">{msg}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={doPush} disabled={busy}>⬆️ Enviar agora</Button>
          <Button variant="ghost" onClick={doPull} disabled={busy}>⬇️ Baixar agora</Button>
        </div>
        <Button variant="danger" onClick={disconnect} className="w-full">
          Desconectar
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">☁️ Sincronizar entre dispositivos</h2>
        <p className="text-sm text-slate-400">
          Salve seu histórico num repositório <strong>privado</strong> do GitHub para acessar de
          outros celulares.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowHelp((s) => !s)}
        className="text-sm text-brand-500 underline"
      >
        {showHelp ? 'Ocultar' : 'Como configurar?'}
      </button>

      {showHelp && (
        <div className="rounded-lg bg-slate-900/50 p-3 text-xs text-slate-300 space-y-2">
          <p>
            <strong>1.</strong> Crie um repositório <strong>privado</strong> no GitHub (ex:{' '}
            <span className="font-mono">financas-dados</span>). Pode deixar vazio.
          </p>
          <p>
            <strong>2.</strong> Gere um token em{' '}
            <span className="font-mono">github.com/settings/personal-access-tokens</span> →{' '}
            <em>Fine-grained token</em>. Em <em>Repository access</em>, selecione só esse repositório;
            em <em>Permissions → Contents</em>, marque <strong>Read and write</strong>.
          </p>
          <p>
            <strong>3.</strong> Cole abaixo o repositório e o token. Em outro celular, instale o app e
            use o <strong>mesmo</strong> repositório e token.
          </p>
          <p className="text-amber-300/80">
            🔒 O token fica guardado só neste dispositivo. Não compartilhe e mantenha o repositório
            privado.
          </p>
        </div>
      )}

      <form onSubmit={connect} className="space-y-3">
        <Field label="Repositório (usuario/repositorio)">
          <TextInput
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="ReginaldoMedeiros/financas-dados"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Field label="Token de acesso">
              <TextInput
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_..."
                autoCapitalize="none"
                autoCorrect="off"
              />
            </Field>
          </div>
          <Field label="Branch">
            <TextInput value={branch} onChange={(e) => setBranch(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
          Sincronizar automaticamente
        </label>

        {msg && <p className="text-sm">{msg}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Conectando...' : 'Conectar'}
        </Button>
      </form>
    </Card>
  );
}
