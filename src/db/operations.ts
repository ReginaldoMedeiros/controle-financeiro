import { db, type Transaction, type EntryKind } from './db';
import { suggestCategory } from '../lib/categorize';
import { txHash } from '../lib/hash';
import { type ParsedRow } from '../lib/parsers/types';

/** Dados de um lançamento manual vindos do formulário. */
export interface ManualEntry {
  date: string;
  description: string;
  amountCents: number;
  kind: EntryKind;
  accountId: number;
  categoryId?: number;
  notes?: string;
}

/**
 * Cria um lançamento manual. Se nenhuma categoria for informada, tenta sugerir
 * uma via regras (reuso de `suggestCategory`).
 */
export async function addManualTransaction(entry: ManualEntry): Promise<number> {
  let categoryId = entry.categoryId;
  if (categoryId == null) {
    const [rules, categories] = await Promise.all([
      db.categoryRules.toArray(),
      db.categories.toArray(),
    ]);
    categoryId = suggestCategory(entry.description, entry.kind, rules, categories);
  }

  const tx: Transaction = {
    date: entry.date,
    description: entry.description,
    amountCents: entry.amountCents,
    kind: entry.kind,
    accountId: entry.accountId,
    categoryId,
    source: 'manual',
    notes: entry.notes,
    hash: txHash({
      date: entry.date,
      amountCents: entry.kind === 'expense' ? -entry.amountCents : entry.amountCents,
      description: entry.description,
      accountId: entry.accountId,
    }),
  };
  return db.transactions.add(tx);
}

/** Linha de importação já com categoria sugerida e flag de duplicata. */
export interface PreviewRow extends ParsedRow {
  hash: string;
  categoryId?: number;
  duplicate: boolean;
  /** Marcada para importação (usuário pode desmarcar). */
  selected: boolean;
}

/**
 * Prepara as linhas de um arquivo para preview: calcula hash, sugere categoria
 * e marca duplicatas comparando com o que já existe na conta.
 */
export async function buildPreview(
  parsed: ParsedRow[],
  accountId: number,
): Promise<PreviewRow[]> {
  const [rules, categories, existing] = await Promise.all([
    db.categoryRules.toArray(),
    db.categories.toArray(),
    db.transactions.where('accountId').equals(accountId).toArray(),
  ]);
  const existingHashes = new Set(existing.map((t) => t.hash));
  const existingIds = new Set(
    existing.map((t) => t.externalId).filter((x): x is string => !!x),
  );
  const seenHashes = new Set<string>();
  const seenIds = new Set<string>();

  return parsed.map((row) => {
    const signed = row.kind === 'expense' ? -row.amountCents : row.amountCents;
    const hash = txHash({
      date: row.date,
      amountCents: signed,
      description: row.description,
      accountId,
    });
    // Dedupe: prioriza o id estável do extrato (Identificador); senão, usa o hash.
    // Vale tanto contra o que já está no banco quanto contra repetições no arquivo.
    let duplicate: boolean;
    if (row.externalId) {
      duplicate = existingIds.has(row.externalId) || seenIds.has(row.externalId);
      seenIds.add(row.externalId);
    } else {
      duplicate = existingHashes.has(hash) || seenHashes.has(hash);
    }
    seenHashes.add(hash);
    const categoryId = suggestCategory(row.description, row.kind, rules, categories);
    return { ...row, hash, categoryId, duplicate, selected: !duplicate };
  });
}

/** Persiste as linhas selecionadas do preview como um lote de importação. */
export async function commitImport(
  rows: PreviewRow[],
  meta: { filename: string; format: string; accountId: number },
): Promise<{ imported: number }> {
  const selected = rows.filter((r) => r.selected);
  if (selected.length === 0) return { imported: 0 };

  return db.transaction('rw', db.transactions, db.importBatches, async () => {
    const batchId = await db.importBatches.add({
      filename: meta.filename,
      format: meta.format,
      accountId: meta.accountId,
      createdAt: new Date().toISOString(),
      importedCount: selected.length,
    });

    const txs: Transaction[] = selected.map((r) => ({
      date: r.date,
      description: r.description,
      rawDescription: r.description,
      amountCents: r.amountCents,
      kind: r.kind,
      categoryId: r.categoryId,
      accountId: meta.accountId,
      source: 'import',
      importBatchId: batchId,
      hash: r.hash,
      externalId: r.externalId,
    }));
    await db.transactions.bulkAdd(txs);
    return { imported: selected.length };
  });
}

/** Cria uma regra de categorização e a aplica retroativamente às transações sem categoria. */
export async function createRuleAndApply(
  pattern: string,
  categoryId: number,
  matchType: 'contains' | 'regex' = 'contains',
): Promise<number> {
  await db.categoryRules.add({ pattern, matchType, categoryId, priority: 5 });
  const category = await db.categories.get(categoryId);
  if (!category) return 0;

  const candidates = await db.transactions
    .filter((t) => t.kind === category.kind)
    .toArray();
  let applied = 0;
  for (const t of candidates) {
    const text = t.description.toLowerCase();
    const matches =
      matchType === 'contains'
        ? text.includes(pattern.toLowerCase())
        : safeRegex(pattern, t.description);
    if (matches && t.categoryId !== categoryId) {
      await db.transactions.update(t.id!, { categoryId });
      applied++;
    }
  }
  return applied;
}

function safeRegex(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(value);
  } catch {
    return false;
  }
}
