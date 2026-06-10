// Sincronização opcional via GitHub: salva/baixa todo o banco em um arquivo
// JSON dentro de um repositório PRIVADO do usuário, usando a REST API do GitHub
// direto do navegador (sem servidor). Estratégia de conflito: "dataset mais
// recente vence" (comparando o campo exportedAt do backup).

import { db } from './db';
import { exportBackup, importBackup } from './backup';

const API = 'https://api.github.com';
const CONFIG_KEY = 'cf.sync.config';
const STATE_KEY = 'cf.sync.state';

export interface SyncConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch: string;
  /** Sincronização automática ligada. */
  auto: boolean;
}

interface SyncState {
  sha?: string;
  lastSyncedAt?: number;
  /** Timestamp da última alteração local real (não conta o seed inicial). */
  localModifiedAt?: number;
  dirty?: boolean;
  lastResult?: string;
  lastError?: string;
}

// Evita que as escritas feitas durante um "pull" disparem auto-push.
let suppress = false;

export function getConfig(): SyncConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? (JSON.parse(raw) as SyncConfig) : null;
}

export function setConfig(cfg: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(STATE_KEY);
}

export function getState(): SyncState {
  const raw = localStorage.getItem(STATE_KEY);
  return raw ? (JSON.parse(raw) as SyncState) : {};
}

function setState(patch: Partial<SyncState>): SyncState {
  const next = { ...getState(), ...patch };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

export function isConnected(): boolean {
  return getConfig() != null;
}

// --- helpers base64 (UTF-8 seguro) ---
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Valida token + acesso ao repositório. Lança Error com mensagem amigável. */
export async function checkRepo(cfg: SyncConfig): Promise<void> {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, {
    headers: headers(cfg.token),
  });
  if (res.status === 401) throw new Error('Token inválido ou expirado.');
  if (res.status === 404)
    throw new Error('Repositório não encontrado ou o token não tem acesso a ele.');
  if (!res.ok) throw new Error(`Erro do GitHub (${res.status}).`);
}

interface RemoteFile {
  sha: string;
  json: { exportedAt?: string } & Record<string, unknown>;
}

/** Lê o arquivo de dados remoto. Retorna null se ainda não existe (404). */
async function getRemote(cfg: SyncConfig): Promise<RemoteFile | null> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(
    cfg.path,
  )}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, { headers: headers(cfg.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao ler do GitHub (${res.status}).`);
  const data = (await res.json()) as { sha: string; content: string };
  const json = JSON.parse(base64ToUtf8(data.content));
  return { sha: data.sha, json };
}

/** Escreve o arquivo de dados remoto (cria ou atualiza). Retorna o novo sha. */
async function putRemote(cfg: SyncConfig, content: string, sha?: string): Promise<string> {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Atualiza dados financeiros — ${new Date().toISOString()}`,
      content: utf8ToBase64(content),
      sha,
      branch: cfg.branch,
    }),
  });
  if (!res.ok) {
    if (res.status === 409) throw new Error('Conflito: o arquivo mudou no GitHub. Tente novamente.');
    throw new Error(`Falha ao enviar ao GitHub (${res.status}).`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return data.content.sha;
}

/** Marca que houve alteração local (chamado pelos hooks do Dexie). */
export function markLocalModified(): void {
  if (suppress) return;
  setState({ localModifiedAt: Date.now(), dirty: true });
}

/** Envia todo o banco local para o GitHub (sobrescreve o remoto). */
export async function pushNow(): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  const backup = await exportBackup();
  const content = JSON.stringify(backup, null, 2);
  const remote = await getRemote(cfg);
  const newSha = await putRemote(cfg, content, remote?.sha);
  setState({
    sha: newSha,
    lastSyncedAt: Date.now(),
    localModifiedAt: Date.parse(backup.exportedAt),
    dirty: false,
    lastResult: `Enviado em ${new Date().toLocaleString('pt-BR')}`,
    lastError: undefined,
  });
}

/** Baixa o banco do GitHub e substitui o local. */
export async function pullNow(): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  const remote = await getRemote(cfg);
  if (!remote) throw new Error('Ainda não há dados salvos no GitHub.');
  suppress = true;
  try {
    await importBackup(remote.json, 'replace');
  } finally {
    suppress = false;
  }
  setState({
    sha: remote.sha,
    lastSyncedAt: Date.now(),
    localModifiedAt: Date.parse(remote.json.exportedAt ?? '') || Date.now(),
    dirty: false,
    lastResult: `Baixado em ${new Date().toLocaleString('pt-BR')}`,
    lastError: undefined,
  });
}

/**
 * Reconciliação ao abrir o app / conectar. Regra "mais recente vence":
 * - sem arquivo remoto → envia o local (semeia a nuvem);
 * - remoto mudou desde a última sync → baixa, a menos que o local tenha
 *   alterações mais novas (compara exportedAt remoto x localModifiedAt);
 * - remoto igual e local sujo → envia.
 */
export async function reconcile(): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  try {
    const remote = await getRemote(cfg);
    const st = getState();

    if (!remote) {
      await pushNow();
      return;
    }

    const remoteAt = Date.parse(remote.json.exportedAt ?? '') || 0;
    const localAt = st.localModifiedAt ?? 0;

    if (remote.sha !== st.sha) {
      // Remoto foi alterado por outro dispositivo.
      if (st.dirty && localAt > remoteAt) {
        await pushNow();
      } else {
        await pullNow();
      }
    } else if (st.dirty) {
      await pushNow();
    } else {
      setState({ sha: remote.sha });
    }
  } catch (e) {
    setState({ lastError: e instanceof Error ? e.message : 'Erro de sincronização.' });
  }
}

// --- auto-push com debounce ---
let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutoPush(): void {
  const cfg = getConfig();
  if (!cfg || !cfg.auto || suppress) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    pushNow().catch((e) =>
      setState({ lastError: e instanceof Error ? e.message : 'Erro ao enviar.' }),
    );
  }, 3000);
}

function onAnyChange(): void {
  markLocalModified();
  scheduleAutoPush();
}

let hooksRegistered = false;

/**
 * Liga os hooks do Dexie em todas as tabelas para detectar qualquer escrita
 * (criação/edição/exclusão) e agendar o envio automático. Deve ser chamado
 * UMA vez, após o seed inicial (para o seed não contar como alteração).
 */
export function registerAutoSync(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;
  const tables = [
    db.accounts,
    db.categories,
    db.transactions,
    db.categoryRules,
    db.importBatches,
    db.recurringItems,
  ];
  for (const t of tables) {
    t.hook('creating', () => onAnyChange());
    t.hook('updating', () => onAnyChange());
    t.hook('deleting', () => onAnyChange());
  }
}
