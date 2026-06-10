import { db, type Category, type CategoryRule } from './db';

// Categorias padrão para o contexto brasileiro. Cores e ícones (emoji) ajudam
// a leitura rápida no celular.
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // Despesas
  { name: 'Alimentação', kind: 'expense', color: '#f97316', icon: '🍽️' },
  { name: 'Mercado', kind: 'expense', color: '#ea580c', icon: '🛒' },
  { name: 'Transporte', kind: 'expense', color: '#3b82f6', icon: '🚗' },
  { name: 'Moradia', kind: 'expense', color: '#8b5cf6', icon: '🏠' },
  { name: 'Contas & Utilidades', kind: 'expense', color: '#6366f1', icon: '💡' },
  { name: 'Saúde', kind: 'expense', color: '#ef4444', icon: '⚕️' },
  { name: 'Educação', kind: 'expense', color: '#0ea5e9', icon: '📚' },
  { name: 'Lazer', kind: 'expense', color: '#ec4899', icon: '🎬' },
  { name: 'Assinaturas', kind: 'expense', color: '#a855f7', icon: '📺' },
  { name: 'Compras', kind: 'expense', color: '#14b8a6', icon: '🛍️' },
  { name: 'Vestuário', kind: 'expense', color: '#d946ef', icon: '👕' },
  { name: 'Pets', kind: 'expense', color: '#84cc16', icon: '🐾' },
  { name: 'Impostos & Taxas', kind: 'expense', color: '#64748b', icon: '🧾' },
  { name: 'Outros', kind: 'expense', color: '#94a3b8', icon: '📦' },
  // Receitas
  { name: 'Salário', kind: 'income', color: '#22c55e', icon: '💰' },
  { name: 'Freelance', kind: 'income', color: '#16a34a', icon: '💻' },
  { name: 'Investimentos', kind: 'income', color: '#10b981', icon: '📈' },
  { name: 'Reembolso', kind: 'income', color: '#34d399', icon: '↩️' },
  { name: 'Outras Receitas', kind: 'income', color: '#4ade80', icon: '🎁' },
];

// Regras de categorização automática por palavra-chave (contains, lowercase).
// A categoria é resolvida pelo nome após o seed das categorias.
const DEFAULT_RULES: { pattern: string; categoryName: string; priority: number }[] = [
  { pattern: 'ifood', categoryName: 'Alimentação', priority: 10 },
  { pattern: 'rappi', categoryName: 'Alimentação', priority: 10 },
  { pattern: 'restaurante', categoryName: 'Alimentação', priority: 5 },
  { pattern: 'lanchonete', categoryName: 'Alimentação', priority: 5 },
  { pattern: 'padaria', categoryName: 'Alimentação', priority: 5 },
  { pattern: 'mercado', categoryName: 'Mercado', priority: 5 },
  { pattern: 'supermerc', categoryName: 'Mercado', priority: 5 },
  { pattern: 'carrefour', categoryName: 'Mercado', priority: 8 },
  { pattern: 'pao de acucar', categoryName: 'Mercado', priority: 8 },
  { pattern: 'assai', categoryName: 'Mercado', priority: 8 },
  { pattern: 'uber', categoryName: 'Transporte', priority: 10 },
  { pattern: '99 ', categoryName: 'Transporte', priority: 8 },
  { pattern: '99app', categoryName: 'Transporte', priority: 8 },
  { pattern: 'posto', categoryName: 'Transporte', priority: 5 },
  { pattern: 'shell', categoryName: 'Transporte', priority: 6 },
  { pattern: 'ipiranga', categoryName: 'Transporte', priority: 6 },
  { pattern: 'estacion', categoryName: 'Transporte', priority: 5 },
  { pattern: 'aluguel', categoryName: 'Moradia', priority: 8 },
  { pattern: 'condominio', categoryName: 'Moradia', priority: 8 },
  { pattern: 'energia', categoryName: 'Contas & Utilidades', priority: 7 },
  { pattern: 'enel', categoryName: 'Contas & Utilidades', priority: 8 },
  { pattern: 'light', categoryName: 'Contas & Utilidades', priority: 6 },
  { pattern: 'sabesp', categoryName: 'Contas & Utilidades', priority: 8 },
  { pattern: 'agua', categoryName: 'Contas & Utilidades', priority: 6 },
  { pattern: 'vivo', categoryName: 'Contas & Utilidades', priority: 7 },
  { pattern: 'claro', categoryName: 'Contas & Utilidades', priority: 7 },
  { pattern: 'tim', categoryName: 'Contas & Utilidades', priority: 6 },
  { pattern: 'internet', categoryName: 'Contas & Utilidades', priority: 6 },
  { pattern: 'farmacia', categoryName: 'Saúde', priority: 7 },
  { pattern: 'drogaria', categoryName: 'Saúde', priority: 7 },
  { pattern: 'drogasil', categoryName: 'Saúde', priority: 8 },
  { pattern: 'hospital', categoryName: 'Saúde', priority: 7 },
  { pattern: 'unimed', categoryName: 'Saúde', priority: 8 },
  { pattern: 'netflix', categoryName: 'Assinaturas', priority: 10 },
  { pattern: 'spotify', categoryName: 'Assinaturas', priority: 10 },
  { pattern: 'disney', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'amazon prime', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'hbo', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'youtube premium', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'icloud', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'google one', categoryName: 'Assinaturas', priority: 9 },
  { pattern: 'amazon', categoryName: 'Compras', priority: 5 },
  { pattern: 'mercado livre', categoryName: 'Compras', priority: 6 },
  { pattern: 'mercadolivre', categoryName: 'Compras', priority: 6 },
  { pattern: 'shopee', categoryName: 'Compras', priority: 6 },
  { pattern: 'aliexpress', categoryName: 'Compras', priority: 6 },
  { pattern: 'cinema', categoryName: 'Lazer', priority: 6 },
  { pattern: 'salario', categoryName: 'Salário', priority: 10 },
  { pattern: 'pagamento de salario', categoryName: 'Salário', priority: 10 },
  { pattern: 'rendimento', categoryName: 'Investimentos', priority: 7 },
  { pattern: 'dividendo', categoryName: 'Investimentos', priority: 8 },
];

let seedPromise: Promise<void> | null = null;

/**
 * Insere categorias e regras padrão apenas na primeira execução (idempotente).
 * Chamado uma vez no boot do app.
 */
export function ensureSeed(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const count = await db.categories.count();
    if (count > 0) return;

    await db.transaction('rw', db.categories, db.categoryRules, db.accounts, async () => {
      const ids = await db.categories.bulkAdd(DEFAULT_CATEGORIES, { allKeys: true });
      const nameToId = new Map<string, number>();
      DEFAULT_CATEGORIES.forEach((c, i) => nameToId.set(c.name, ids[i] as number));

      const rules: Omit<CategoryRule, 'id'>[] = [];
      for (const r of DEFAULT_RULES) {
        const categoryId = nameToId.get(r.categoryName);
        if (categoryId != null) {
          rules.push({
            pattern: r.pattern,
            matchType: 'contains',
            categoryId,
            priority: r.priority,
          });
        }
      }
      await db.categoryRules.bulkAdd(rules);

      // Conta padrão para facilitar o primeiro uso.
      const anyAccount = await db.accounts.count();
      if (anyAccount === 0) {
        await db.accounts.add({ name: 'Conta Principal', type: 'checking' });
      }
    });
  })();
  return seedPromise;
}
