// Única fonte de verdade para conversão e formatação de moeda (BRL <-> centavos).

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata centavos como "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** Formata centavos com sinal explícito conforme o tipo de lançamento. */
export function formatSigned(cents: number, kind: 'expense' | 'income'): string {
  const sign = kind === 'expense' ? '-' : '+';
  return `${sign} ${BRL.format(Math.abs(cents) / 100)}`;
}

/**
 * Converte texto digitado/importado em centavos (inteiro positivo).
 * Aceita formatos BR ("1.234,56") e simples ("1234.56", "1234").
 * Retorna NaN se não houver dígitos.
 */
export function parseToCents(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  let s = input.trim();
  if (!s) return NaN;

  // Remove símbolo de moeda e espaços
  s = s.replace(/r\$/i, '').replace(/\s/g, '');
  const negative = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/-/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // O último separador é o decimal (formato BR: 1.234,56)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot) {
    // Só ponto é ambíguo. Vários pontos = separador de milhar ("1.000.000").
    // Um ponto seguido de 3 dígitos também = milhar ("1.000" -> 1000);
    // 1 ou 2 dígitos após o ponto = decimal ("1234.56", "1.5").
    const dotCount = (s.match(/\./g) || []).length;
    const afterDot = s.slice(s.lastIndexOf('.') + 1);
    if (dotCount > 1 || afterDot.length === 3) {
      s = s.replace(/\./g, '');
    }
  }

  const value = Number(s);
  if (Number.isNaN(value)) return NaN;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/** Formata centavos como número editável "1234,56" (sem símbolo). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
