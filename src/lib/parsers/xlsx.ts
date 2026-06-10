import * as XLSX from 'xlsx';

/**
 * Lê a primeira planilha de um arquivo Excel e devolve no mesmo formato do CSV
 * (headers + linhas como objetos), reaproveitando o mapeamento de colunas.
 */
export function parseXlsxRaw(
  data: ArrayBuffer,
): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(data, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];

  // Lê como matriz para localizar a linha de cabeçalho real (extratos costumam
  // ter linhas de título antes da tabela).
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const headerIdx = findHeaderRow(matrix);
  if (headerIdx < 0) return { headers: [], rows: [] };

  const headers = matrix[headerIdx].map((h) => String(h).trim()).filter(Boolean);
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((c) => String(c).trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = r[j] != null ? String(r[j]).trim() : '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

/** Heurística: a linha de cabeçalho é a que contém termos típicos de extrato. */
function findHeaderRow(matrix: string[][]): number {
  const keys = ['data', 'valor', 'descri', 'histor', 'lançamento', 'lancamento', 'date', 'amount'];
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const cells = (matrix[i] ?? []).map((c) => String(c).toLowerCase());
    const hits = keys.filter((k) => cells.some((c) => c.includes(k))).length;
    if (hits >= 2) return i;
  }
  // fallback: primeira linha não vazia
  return matrix.findIndex((r) => r && r.some((c) => String(c).trim() !== ''));
}
