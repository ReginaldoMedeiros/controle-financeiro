import { z } from 'zod';
import {
  db,
  type Account,
  type Category,
  type Transaction,
  type CategoryRule,
  type ImportBatch,
  type RecurringItem,
} from './db';

const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'controle-financeiro';
  version: number;
  exportedAt: string;
  data: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    categoryRules: CategoryRule[];
    importBatches: ImportBatch[];
    recurringItems: RecurringItem[];
  };
}

/** Exporta todo o banco para um objeto serializável. */
export async function exportBackup(): Promise<BackupFile> {
  const [accounts, categories, transactions, categoryRules, importBatches, recurringItems] =
    await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.categoryRules.toArray(),
      db.importBatches.toArray(),
      db.recurringItems.toArray(),
    ]);

  return {
    app: 'controle-financeiro',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, categories, transactions, categoryRules, importBatches, recurringItems },
  };
}

/** Dispara o download do backup como arquivo JSON. */
export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `controle-financeiro-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const backupSchema = z.object({
  app: z.literal('controle-financeiro'),
  version: z.number(),
  data: z.object({
    accounts: z.array(z.any()),
    categories: z.array(z.any()),
    transactions: z.array(z.any()),
    categoryRules: z.array(z.any()),
    importBatches: z.array(z.any()),
    recurringItems: z.array(z.any()),
  }),
});

/**
 * Importa um backup. `mode: 'replace'` apaga tudo antes; `mode: 'merge'`
 * mantém os dados atuais e adiciona os do arquivo (novos ids autoincrement).
 */
export async function importBackup(
  json: unknown,
  mode: 'replace' | 'merge',
): Promise<{ imported: number }> {
  const parsed = backupSchema.parse(json);
  const d = parsed.data as BackupFile['data'];

  const tables = [
    db.accounts,
    db.categories,
    db.transactions,
    db.categoryRules,
    db.importBatches,
    db.recurringItems,
  ];

  let imported = 0;
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.map((t) => t.clear()));
      // Em replace, preserva os ids originais (bulkAdd com keys embutidas).
      await db.accounts.bulkAdd(d.accounts);
      await db.categories.bulkAdd(d.categories);
      await db.categoryRules.bulkAdd(d.categoryRules);
      await db.importBatches.bulkAdd(d.importBatches);
      await db.recurringItems.bulkAdd(d.recurringItems);
      await db.transactions.bulkAdd(d.transactions);
      imported = d.transactions.length;
    } else {
      // Merge: descarta ids para evitar colisão; relações de id não são
      // remapeadas (limitação assumida do merge simples).
      const strip = <T extends { id?: number }>(arr: T[]) =>
        arr.map(({ id: _id, ...rest }) => rest as T);
      await db.accounts.bulkAdd(strip(d.accounts));
      await db.categories.bulkAdd(strip(d.categories));
      await db.categoryRules.bulkAdd(strip(d.categoryRules));
      await db.recurringItems.bulkAdd(strip(d.recurringItems));
      // transações: evita duplicar por hash
      const existing = new Set((await db.transactions.toArray()).map((t) => t.hash));
      const toAdd = strip(d.transactions).filter((t) => !existing.has(t.hash));
      await db.transactions.bulkAdd(toAdd);
      imported = toAdd.length;
    }
  });

  return { imported };
}
