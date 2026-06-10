import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export function useCategories() {
  return useLiveQuery(() => db.categories.toArray(), [], []);
}

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray(), [], []);
}

export function useRules() {
  return useLiveQuery(() => db.categoryRules.toArray(), [], []);
}

export function useRecurring() {
  return useLiveQuery(() => db.recurringItems.toArray(), [], []);
}

/** Todas as transações ordenadas por data desc (mais recentes primeiro). */
export function useAllTransactions() {
  return useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    [],
    [],
  );
}

/** Mapa id->categoria para lookup rápido na UI. */
export function useCategoryMap() {
  const cats = useCategories();
  const map = new Map<number, (typeof cats)[number]>();
  for (const c of cats) if (c.id != null) map.set(c.id, c);
  return map;
}
