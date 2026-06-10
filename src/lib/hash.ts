// Hash determinístico simples (FNV-1a 32-bit) em hex. Suficiente para
// deduplicar transações reimportadas — não é uso criptográfico.
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Hash de uma transação para detectar duplicatas (mesma data+valor+descrição+conta). */
export function txHash(parts: {
  date: string;
  amountCents: number;
  description: string;
  accountId: number;
}): string {
  const norm = parts.description.trim().toLowerCase().replace(/\s+/g, ' ');
  return fnv1a(`${parts.date}|${parts.amountCents}|${norm}|${parts.accountId}`);
}
