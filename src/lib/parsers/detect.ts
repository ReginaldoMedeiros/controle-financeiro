import { type ImportFormat } from './types';

/** Detecta o formato do arquivo pela extensão e tipo MIME. */
export function detectFormat(file: File): ImportFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('sheet'))
    return 'xlsx';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  return null;
}
