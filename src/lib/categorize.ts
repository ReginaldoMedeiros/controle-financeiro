import { type Category, type CategoryRule, type EntryKind } from '../db/db';

/**
 * Resolve a melhor categoria para uma descrição aplicando as regras em ordem
 * de prioridade (maior primeiro). Respeita o tipo do lançamento: regras só
 * casam com categorias do mesmo `kind` (despesa/receita).
 * Reusado tanto na importação quanto no cadastro manual.
 */
export function suggestCategory(
  description: string,
  kind: EntryKind,
  rules: CategoryRule[],
  categories: Category[],
): number | undefined {
  const text = description.toLowerCase();
  const catById = new Map<number, Category>();
  for (const c of categories) if (c.id != null) catById.set(c.id, c);

  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    const cat = catById.get(rule.categoryId);
    if (!cat || cat.kind !== kind) continue;

    if (rule.matchType === 'contains') {
      if (text.includes(rule.pattern.toLowerCase())) return rule.categoryId;
    } else {
      try {
        if (new RegExp(rule.pattern, 'i').test(description)) return rule.categoryId;
      } catch {
        /* regex inválida — ignora a regra */
      }
    }
  }
  return undefined;
}
