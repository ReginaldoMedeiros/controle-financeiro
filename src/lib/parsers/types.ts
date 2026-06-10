import { type EntryKind } from '../../db/db';

/** Linha bruta extraída de um arquivo, antes de virar Transaction. */
export interface ParsedRow {
  /** Data ISO 'YYYY-MM-DD'. */
  date: string;
  description: string;
  /** Valor em centavos, positivo. */
  amountCents: number;
  kind: EntryKind;
  /** Id estável do extrato (ex: Identificador do Nubank), quando disponível. */
  externalId?: string;
}

export type ImportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ParseResult {
  rows: ParsedRow[];
  /** Avisos não-fatais (linhas ignoradas, datas suspeitas, etc.). */
  warnings: string[];
  /** Dica de layout detectado (ex: 'Nubank fatura', 'genérico'). */
  layout?: string;
}

/**
 * Converte várias representações de data BR/ISO para 'YYYY-MM-DD'.
 * Aceita: 'dd/mm/aaaa', 'dd/mm/aa', 'aaaa-mm-dd', 'dd-mm-aaaa', e datas com
 * mês textual ('12 jan 2025' / '12 JAN'). Retorna null se não reconhecer.
 */
export function normalizeDate(raw: string, fallbackYear?: number): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // ISO já pronto
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // dd/mm/aaaa ou dd-mm-aaaa ou dd.mm.aaaa
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // mês textual: "12 jan 2025", "12 jan", "12 de janeiro"
  const months: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  };
  m = s.match(/^(\d{1,2})\s*(?:de\s+)?([a-zç]{3})[a-zç]*\.?\s*(\d{4})?/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = months[m[2]];
    const y = m[3] ?? String(fallbackYear ?? new Date().getFullYear());
    if (mo) return `${y}-${mo}-${d}`;
  }

  return null;
}
