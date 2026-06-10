import { useMemo, useState } from 'react';
import { useAccounts, useCategories } from '../hooks/useData';
import { detectFormat } from '../lib/parsers/detect';
import {
  applyMapping,
  guessMapping,
  parseCsvRaw,
  type ColumnMapping,
} from '../lib/parsers/csv';
// xlsx e pdf.js são pesados — carregados sob demanda (code-splitting) só ao importar.
import { type PdfMode } from '../lib/parsers/pdf';
import { type ImportFormat, type ParsedRow } from '../lib/parsers/types';
import { buildPreview, commitImport, type PreviewRow } from '../db/operations';
import { formatDayMonth } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { Button, Card, Field, SegmentedControl, Select } from '../components/ui';

type Step = 'upload' | 'map' | 'preview' | 'done';

export default function Import() {
  const accounts = useAccounts();
  const categories = useCategories();

  const [step, setStep] = useState<Step>('upload');
  const [accountId, setAccountId] = useState<number | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // CSV/Excel
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateCol: '',
    descCol: '',
    amountCol: '',
    amountMode: 'signed',
  });

  // PDF
  const [pdfMode, setPdfMode] = useState<PdfMode>('statement');

  // Preview
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const effectiveAccount = accountId ?? accounts[0]?.id;

  async function handleFile(f: File) {
    setError('');
    const fmt = detectFormat(f);
    if (!fmt) {
      setError('Formato não suportado. Use CSV, Excel (.xlsx) ou PDF.');
      return;
    }
    setFile(f);
    setFormat(fmt);

    try {
      setBusy(true);
      if (fmt === 'csv') {
        const text = await f.text();
        const { headers, rows } = parseCsvRaw(text);
        if (headers.length === 0) throw new Error('Não foi possível ler colunas do CSV.');
        setRawHeaders(headers);
        setRawRows(rows);
        setMapping((m) => ({ ...m, ...guessMapping(headers) } as ColumnMapping));
        setStep('map');
      } else if (fmt === 'xlsx') {
        const buf = await f.arrayBuffer();
        const { parseXlsxRaw } = await import('../lib/parsers/xlsx');
        const { headers, rows } = parseXlsxRaw(buf);
        if (headers.length === 0) throw new Error('Não foi possível ler colunas da planilha.');
        setRawHeaders(headers);
        setRawRows(rows);
        setMapping((m) => ({ ...m, ...guessMapping(headers) } as ColumnMapping));
        setStep('map');
      } else {
        // PDF: vai direto para o modo + parse
        await runPdf(f, pdfMode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  async function runPdf(f: File, mode: PdfMode) {
    setBusy(true);
    setError('');
    try {
      const buf = await f.arrayBuffer();
      const { parsePdf } = await import('../lib/parsers/pdf');
      const result = await parsePdf(buf, mode);
      await toPreview(result.rows, result.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar o PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function runMapping() {
    if (!mapping.dateCol || !mapping.descCol || !mapping.amountCol) {
      setError('Selecione as colunas de data, descrição e valor.');
      return;
    }
    setError('');
    const result = applyMapping(rawRows, mapping);
    await toPreview(result.rows, result.warnings);
  }

  async function toPreview(rows: ParsedRow[], warns: string[]) {
    if (!effectiveAccount) {
      setError('Selecione uma conta.');
      return;
    }
    const pv = await buildPreview(rows, effectiveAccount);
    setPreview(pv);
    setWarnings(warns);
    setStep('preview');
  }

  async function confirm() {
    if (!effectiveAccount || !file || !format) return;
    setBusy(true);
    const { imported } = await commitImport(preview, {
      filename: file.name,
      format,
      accountId: effectiveAccount,
    });
    setImportedCount(imported);
    setBusy(false);
    setStep('done');
  }

  function reset() {
    setStep('upload');
    setFile(null);
    setFormat(null);
    setPreview([]);
    setWarnings([]);
    setError('');
  }

  const selectedCount = useMemo(() => preview.filter((r) => r.selected).length, [preview]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importar extrato</h1>

      {error && (
        <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* STEP: upload */}
      {step === 'upload' && (
        <Card className="space-y-4">
          <Field label="Conta de destino">
            <Select
              value={effectiveAccount ?? ''}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-600 py-10 text-center cursor-pointer">
            <span className="text-4xl">📥</span>
            <span className="font-medium">Toque para escolher o arquivo</span>
            <span className="text-xs text-slate-400">CSV, Excel (.xlsx) ou PDF</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {busy && <p className="text-center text-sm text-slate-400">Lendo arquivo...</p>}
        </Card>
      )}

      {/* STEP: map (CSV/Excel) */}
      {step === 'map' && (
        <Card className="space-y-3">
          <p className="text-sm text-slate-400">
            Confirme quais colunas correspondem a cada campo. Detectamos automaticamente quando possível.
          </p>
          <Field label="Coluna da data">
            <Select value={mapping.dateCol} onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}>
              <option value="">Selecione...</option>
              {rawHeaders.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
          </Field>
          <Field label="Coluna da descrição">
            <Select value={mapping.descCol} onChange={(e) => setMapping({ ...mapping, descCol: e.target.value })}>
              <option value="">Selecione...</option>
              {rawHeaders.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
          </Field>
          <Field label="Coluna do valor">
            <Select value={mapping.amountCol} onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}>
              <option value="">Selecione...</option>
              {rawHeaders.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
          </Field>
          <Field label="Como interpretar o valor">
            <SegmentedControl
              value={mapping.amountMode ?? 'signed'}
              onChange={(v) => setMapping({ ...mapping, amountMode: v })}
              options={[
                { value: 'signed', label: 'Com sinal (+/−)' },
                { value: 'expense', label: 'Só despesas' },
                { value: 'income', label: 'Só receitas' },
              ]}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} className="flex-1">Voltar</Button>
            <Button onClick={runMapping} className="flex-1">Pré-visualizar</Button>
          </div>
        </Card>
      )}

      {/* STEP: preview */}
      {step === 'preview' && (
        <div className="space-y-3">
          {format === 'pdf' && (
            <Card className="space-y-2">
              <Field label="Tipo de documento PDF">
                <SegmentedControl
                  value={pdfMode}
                  onChange={(v) => {
                    setPdfMode(v);
                    if (file) runPdf(file, v);
                  }}
                  options={[
                    { value: 'statement', label: 'Extrato bancário' },
                    { value: 'invoice', label: 'Fatura de cartão' },
                  ]}
                />
              </Field>
            </Card>
          )}

          {warnings.length > 0 && (
            <Card className="!bg-amber-500/10 border-amber-500/30">
              <p className="mb-1 text-sm font-medium text-amber-300">Avisos</p>
              <ul className="space-y-0.5 text-xs text-amber-200/80 max-h-28 overflow-y-auto">
                {warnings.slice(0, 8).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {preview.length} linhas · {selectedCount} selecionadas
            </span>
            {preview.some((r) => r.duplicate) && (
              <span className="text-amber-400">duplicatas desmarcadas</span>
            )}
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
            {preview.map((row, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 ${
                  row.selected ? 'bg-slate-800/60' : 'bg-slate-900/40 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => {
                      const next = [...preview];
                      next[i] = { ...row, selected: e.target.checked };
                      setPreview(next);
                    }}
                    className="h-5 w-5 accent-brand-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.description}</div>
                    <div className="text-xs text-slate-400">
                      {formatDayMonth(row.date)}
                      {row.duplicate && ' · já existe'}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${row.kind === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {row.kind === 'income' ? '+' : '−'} {formatBRL(row.amountCents)}
                  </span>
                </div>
                <div className="mt-1.5 pl-7">
                  <Select
                    value={row.categoryId ?? ''}
                    onChange={(e) => {
                      const next = [...preview];
                      next[i] = {
                        ...row,
                        categoryId: e.target.value ? Number(e.target.value) : undefined,
                      };
                      setPreview(next);
                    }}
                    className="!py-1.5 text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {categories
                      .filter((c) => c.kind === row.kind)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} className="flex-1">Cancelar</Button>
            <Button onClick={confirm} disabled={selectedCount === 0 || busy} className="flex-1">
              Importar {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          </div>
        </div>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <Card className="text-center space-y-3 py-8">
          <div className="text-4xl">✅</div>
          <p className="font-medium">{importedCount} lançamentos importados!</p>
          <Button onClick={reset} className="w-full">Importar outro arquivo</Button>
        </Card>
      )}
    </div>
  );
}
