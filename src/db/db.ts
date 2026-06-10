import Dexie, { type Table } from 'dexie';

// Tipos do domínio. Valores monetários SEMPRE em centavos (inteiro) para
// evitar erros de ponto flutuante.

export type AccountType = 'checking' | 'credit';
export type EntryKind = 'expense' | 'income';
export type TxSource = 'manual' | 'import';
export type RuleMatch = 'contains' | 'regex';

export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  institution?: string;
}

export interface Category {
  id?: number;
  name: string;
  kind: EntryKind;
  color: string;
  icon: string;
  parentId?: number;
}

export interface Transaction {
  id?: number;
  /** Data no formato ISO 'YYYY-MM-DD' (facilita ordenar/filtrar por mês). */
  date: string;
  description: string;
  /** Descrição original do extrato, preservada na importação. */
  rawDescription?: string;
  /** Valor sempre positivo em centavos; o sinal vem de `kind`. */
  amountCents: number;
  kind: EntryKind;
  categoryId?: number;
  accountId: number;
  source: TxSource;
  importBatchId?: number;
  notes?: string;
  /** Hash determinístico para deduplicar reimportações. */
  hash: string;
  /** Id externo estável do extrato (ex: Identificador do Nubank) para dedupe robusto. */
  externalId?: string;
}

export interface CategoryRule {
  id?: number;
  pattern: string;
  matchType: RuleMatch;
  categoryId: number;
  priority: number;
}

export interface ImportBatch {
  id?: number;
  filename: string;
  format: string;
  accountId: number;
  createdAt: string;
  importedCount: number;
}

export interface RecurringItem {
  id?: number;
  description: string;
  amountCents: number;
  kind: EntryKind;
  /** Dia do mês (1-31) em que o lançamento ocorre. */
  dayOfMonth: number;
  categoryId?: number;
  active: boolean;
}

class FinanceDB extends Dexie {
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  categoryRules!: Table<CategoryRule, number>;
  importBatches!: Table<ImportBatch, number>;
  recurringItems!: Table<RecurringItem, number>;

  constructor() {
    super('controle-financeiro');
    this.version(1).stores({
      accounts: '++id, name, type',
      categories: '++id, name, kind, parentId',
      transactions:
        '++id, date, accountId, categoryId, kind, source, importBatchId, hash',
      categoryRules: '++id, categoryId, priority',
      importBatches: '++id, createdAt, accountId',
      recurringItems: '++id, active, kind',
    });
    // v2: índice por externalId (Identificador do extrato) para dedupe confiável.
    this.version(2).stores({
      transactions:
        '++id, date, accountId, categoryId, kind, source, importBatchId, hash, externalId',
    });
  }
}

export const db = new FinanceDB();

/**
 * Pede ao navegador armazenamento persistente, reduzindo a chance do iOS
 * limpar o IndexedDB sob pressão de espaço. Best-effort: ignora se indisponível.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* sem suporte — segue sem persistência garantida */
  }
  return false;
}
