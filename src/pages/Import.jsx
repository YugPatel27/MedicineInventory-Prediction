import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { UploadCloud, CheckCircle2, FileText } from '../components/Icons';

const importSteps = [
  'Upload a CSV or Excel file from your local machine',
  'Validate the medicine, stock, and expiry columns',
  'Insert clean rows into MongoDB',
  'Show success and error counts for auditability',
];

const MAX_BYTES = 10 * 1024 * 1024;

const hasEmoji = (s) => /[\p{Emoji}\p{So}\uFE0F]/u.test(s);

const normalizePreviewRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((header) => String(header ?? '').trim());
  const dataRows = rows.slice(1).map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
  return { headers, rows: dataRows };
};

const getPreviewDataFromFile = async (selectedFile, lower) => {
  if (lower.endsWith('.json')) {
    const raw = await selectedFile.text();
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : parsed.records || [];
    if (!Array.isArray(records)) {
      throw new Error('JSON must contain an array of medicine records.');
    }
    const headers = Array.from(new Set(records.flatMap((item) => Object.keys(item))));
    const rows = records.slice(0, 10).map((item) => headers.map((header) => item[header] ?? ''));
    return { headers, rows };
  }

  const xlsx = await import('xlsx');
  let workbook;
  if (lower.endsWith('.csv')) {
    const text = await selectedFile.text();
    workbook = xlsx.read(text, { type: 'string', raw: false, cellDates: true });
  } else {
    const buffer = await selectedFile.arrayBuffer();
    workbook = xlsx.read(buffer, { type: 'array', cellDates: true, raw: false });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error('Unable to read spreadsheet data.');
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(0, 10);
  return normalizePreviewRows(rows);
};

export function Import() {
  const [file, setFile] = useState(null);
  const [validated, setValidated] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    document.title = 'Import — MediStock';
    // focus file input and highlight it briefly so users see where to interact
    const t = setTimeout(() => {
      if (fileRef.current) {
        fileRef.current.focus();
        setHighlight(true);
        setTimeout(() => setHighlight(false), 900);
      }
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setError('');
    setResult(null);
    setPreview(null);
    setValidated(false);

    if (!selectedFile) return;
    if (selectedFile.size > MAX_BYTES) {
      setError('File too large. Maximum allowed is 10MB.');
      setFile(null);
      return;
    }
    if (hasEmoji(selectedFile.name)) {
      setError('Filenames must not contain emoji or unusual characters.');
      setFile(null);
      return;
    }

    const lower = selectedFile.name.toLowerCase();
    const fileType = selectedFile.type || (lower.endsWith('.csv')
      ? 'text/csv'
      : lower.endsWith('.xlsx') || lower.endsWith('.xls')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : lower.endsWith('.json')
      ? 'application/json'
      : 'application/octet-stream');

    if (lower.endsWith('.pdf')) {
      setError('PDF import is not supported. Please upload CSV, XLSX, or JSON files.');
      setFile(null);
      return;
    }

    const isJsonImport = lower.endsWith('.json');
    const previewable = isJsonImport || lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');

    setPreview({
      name: selectedFile.name,
      size: `${Math.round(selectedFile.size / 1024)} KB`,
      type: fileType,
      previewable,
      isJson: isJsonImport,
    });
    setValidated(true);

    if (previewable) {
      try {
        const previewData = await getPreviewDataFromFile(selectedFile, lower);
        setPreviewData(previewData);
      } catch (previewError) {
        console.warn('Preview parse failed', previewError);
        setPreviewData(null);
      }
    } else {
      setPreviewData(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    if (!validated) {
      setError('Please validate the file before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setError('');

    try {
      const { data } = await apiClient.post('/import/bulk-insert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data.data || null);
      if (data.data?.inserted === 0 && data.data?.failed > 0) {
        setError('No valid rows found. Please check your file and try again.');
      }
    } catch (uploadError) {
      console.error('Import failed', uploadError);
      setError(uploadError?.response?.data?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Import</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Bulk medicine upload</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Upload Excel or CSV data to add inventory records without paid APIs or cloud dependencies.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Validation steps</p>
            <div className="grid gap-3">
              {importSteps.map((step, index) => (
                <div key={step} className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">Step {index + 1}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">Choose a file</h2>
            <p className="mt-2 text-sm text-muted-foreground">CSV and XLSX files under 10MB are supported.</p>
          </div>

          <div className="mt-6 space-y-4">
            <input
              ref={fileRef}
              id="import-file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleFileChange}
              className={`w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground ${highlight ? 'ring-2 ring-sky-300' : ''}`}
            />
            {preview && (
              <div className="rounded-3xl border border-border bg-white p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Selected file</p>
                <p className="mt-2">{preview.name}</p>
                <p className="text-xs">{preview.size} • {preview.type}</p>
                {previewData ? (
                  <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Preview</div>
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr>
                          {previewData.headers.map((header, index) => (
                            <th key={index} className="border-b border-border px-2 py-1 font-semibold text-slate-600">{header || `Col ${index + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="odd:bg-white even:bg-slate-100">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="border-b border-border px-2 py-1 text-slate-700">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-border bg-slate-50 p-4 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Preview unavailable</p>
                    <p className="mt-2">
                      Selected file is accepted but preview is only available for CSV, XLSX, XLS, and JSON formats.
                    </p>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Processing...' : 'Upload & process dataset'}
            </button>
            {error && <Alert type="danger">{error}</Alert>}
          </div>
        </div>
      </section>

      {result && (
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-3xl border border-sky-200 bg-sky-50 p-4">
              <div className="rounded-3xl bg-sky-100 p-3 text-sky-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Import completed</p>
                <p className="text-sm text-muted-foreground">{result.inserted} rows inserted. {result.failed} rows failed.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-white p-4">
                <p className="text-sm text-muted-foreground">Total rows</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{result.total_rows}</p>
              </div>
              <div className="rounded-3xl border border-border bg-white p-4">
                <p className="text-sm text-muted-foreground">Inserted</p>
                <p className="mt-2 text-3xl font-semibold text-sky-700">{result.inserted}</p>
              </div>
              <div className="rounded-3xl border border-border bg-white p-4">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="mt-2 text-3xl font-semibold text-sky-700">{result.failed}</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="rounded-3xl border border-border bg-white p-4">
                <p className="text-sm font-semibold text-foreground">Validation details</p>
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm text-muted-foreground">
                  {result.errors.map((errorItem, index) => (
                    <li key={index}>{`Row ${errorItem.row || index + 1}: ${errorItem.message}`}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
