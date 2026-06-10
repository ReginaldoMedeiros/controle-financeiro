import * as pdfjs from 'pdfjs-dist';
// Worker do pdf.js empacotado pelo Vite (roda no próprio navegador).
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseToCents } from '../money';
import { normalizeDate, type ParseResult, type ParsedRow } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;

/** 'statement' = extrato bancário (valores com sinal); 'invoice' = fatura de cartão (despesas). */
export type PdfMode = 'statement' | 'invoice';

/** Extrai o texto do PDF agrupando itens por linha (coordenada Y). */
async function extractLines(data: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Agrupa por Y (arredondado) para reconstruir linhas visuais.
    const byRow = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const arr = byRow.get(y) ?? [];
      arr.push({ x, str: item.str });
      byRow.set(y, arr);
    }
    // Ordena linhas de cima para baixo, e itens da esquerda para a direita.
    const ys = [...byRow.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const row = byRow.get(y)!.sort((a, b) => a.x - b.x);
      const text = row.map((r) => r.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

const MONEY_RE = /-?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}/g;
const DATE_START_RE =
  /^(\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\d{1,2}\s+(?:de\s+)?[a-zç]{3,})/i;

/**
 * Heurística genérica linha-a-linha para extratos e faturas em PDF de texto.
 * Funciona melhor com PDFs "de texto" (não escaneados). Bancos-alvo iniciais:
 * Nubank, Itaú, Bradesco, Inter — mas o parser é tolerante a layouts variados.
 */
export async function parsePdf(data: ArrayBuffer, mode: PdfMode): Promise<ParseResult> {
  const lines = await extractLines(data);
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];

  // Tenta achar o ano no texto para datas de fatura sem ano ("12 JAN").
  const yearMatch = lines.join(' ').match(/\b(20\d{2})\b/);
  const fallbackYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  for (const raw of lines) {
    // Normaliza "menos" unicode (−, –, —) para hífen ASCII antes de tudo.
    const line = raw.replace(/[−–—]/g, '-');
    if (!DATE_START_RE.test(line)) continue;
    const dateMatch = line.match(DATE_START_RE);
    if (!dateMatch) continue;
    const date = normalizeDate(dateMatch[0], fallbackYear);
    if (!date) continue;

    const monies = line.match(MONEY_RE);
    if (!monies || monies.length === 0) continue;

    // O último valor monetário da linha costuma ser o valor da transação.
    const rawValue = monies[monies.length - 1];
    const cents = parseToCents(rawValue);
    if (Number.isNaN(cents) || cents === 0) continue;

    // Descrição = linha sem a data inicial e sem os valores monetários.
    let desc = line
      .replace(DATE_START_RE, '')
      .replace(MONEY_RE, '')
      .replace(/r\$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc) desc = '(sem descrição)';

    let kind: 'expense' | 'income';
    const negative = cents < 0 || /^-/.test(rawValue.trim());
    if (mode === 'invoice') {
      // Fatura: tudo é despesa, exceto pagamentos/estornos.
      const isCredit = /pagamento|estorno|cr[ée]dito|ajuste/i.test(desc) || negative;
      kind = isCredit ? 'income' : 'expense';
    } else {
      kind = negative ? 'expense' : 'income';
    }

    rows.push({ date, description: desc, amountCents: Math.abs(cents), kind });
  }

  if (rows.length === 0) {
    warnings.push(
      'Nenhuma transação reconhecida. O PDF pode ser escaneado (imagem) ou ter um layout não suportado. Tente exportar em CSV/Excel.',
    );
  }

  return { rows, warnings, layout: mode === 'invoice' ? 'Fatura (PDF)' : 'Extrato (PDF)' };
}
