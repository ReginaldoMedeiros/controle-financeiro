import Papa from 'papaparse';
import { parseToCents } from '../money';
import { normalizeDate, type ParseResult, type ParsedRow } from './types';

export interface ColumnMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  /** Coluna separada para crédito (entrada), opcional. */
  creditCol?: string;
  /**
   * Como interpretar o sinal da coluna de valor:
   * - 'signed': negativo = despesa, positivo = receita (padrão).
   * - 'expense': todos os valores são despesas.
   * - 'income': todos os valores são receitas.
   */
  amountMode?: 'signed' | 'expense' | 'income';
}

/** Faz parse do CSV em linhas + cabeçalhos para a UI montar o mapeamento. */
export function parseCsvRaw(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: '', // autodetecta , ou ;
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}

/** Tenta adivinhar quais colunas são data/descrição/valor pelos nomes. */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (...keys: string[]) => {
    for (const k of keys) {
      const i = lower.findIndex((h) => h.includes(k));
      if (i >= 0) return headers[i];
    }
    return undefined;
  };
  return {
    dateCol: find('data', 'date', 'dt'),
    descCol: find('descri', 'histor', 'lançamento', 'lancamento', 'estabelec', 'title', 'memo'),
    amountCol: find('valor', 'amount', 'value', 'montante', 'débito', 'debito'),
    creditCol: find('crédito', 'credito', 'entrada'),
  };
}

/** Aplica o mapeamento e converte as linhas em ParsedRow. */
export function applyMapping(
  rows: Record<string, string>[],
  map: ColumnMapping,
): ParseResult {
  const out: ParsedRow[] = [];
  const warnings: string[] = [];
  const mode = map.amountMode ?? 'signed';

  rows.forEach((row, i) => {
    const dateRaw = (row[map.dateCol] ?? '').trim();
    const desc = (row[map.descCol] ?? '').trim();
    const date = normalizeDate(dateRaw);

    if (!date) {
      if (dateRaw || desc) warnings.push(`Linha ${i + 2}: data inválida ("${dateRaw}"), ignorada.`);
      return;
    }

    let cents = parseToCents(row[map.amountCol] ?? '');
    // Coluna de crédito separada soma como entrada.
    if (map.creditCol) {
      const credit = parseToCents(row[map.creditCol] ?? '');
      if (!Number.isNaN(credit) && credit !== 0) {
        out.push({ date, description: desc || '(sem descrição)', amountCents: Math.abs(credit), kind: 'income' });
      }
    }

    if (Number.isNaN(cents) || cents === 0) {
      if (!map.creditCol) warnings.push(`Linha ${i + 2}: valor inválido, ignorada.`);
      return;
    }

    let kind: 'expense' | 'income';
    if (mode === 'expense') kind = 'expense';
    else if (mode === 'income') kind = 'income';
    else kind = cents < 0 ? 'expense' : 'income';

    out.push({
      date,
      description: desc || '(sem descrição)',
      amountCents: Math.abs(cents),
      kind,
    });
  });

  return { rows: out, warnings, layout: 'CSV mapeado' };
}
