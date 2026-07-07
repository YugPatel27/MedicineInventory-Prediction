import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Download, Calendar, BarChart3, Filter } from '../components/Icons';

function summarizeMedicines(medicines) {
  const totalStock = medicines.reduce((sum, medicine) => sum + Number(medicine.stock_quantity || 0), 0);
  const lowStock = medicines.filter((medicine) => Number(medicine.stock_quantity || 0) > 0 && Number(medicine.stock_quantity || 0) <= 10).length;
  const outOfStock = medicines.filter((medicine) => Number(medicine.stock_quantity || 0) === 0).length;
  const expiringSoon = medicines.filter((medicine) => {
    if (!medicine.expiry_date) return false;
    const days = Math.ceil((new Date(medicine.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }).length;

  return {
    title: 'Inventory report',
    totalMedicines: medicines.length,
    totalStock,
    lowStock,
    outOfStock,
    expiringSoon,
  };
}

async function buildPdfBlob(reportType, summary, rows, dateRange) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ compress: true });

  doc.setFontSize(18);
  doc.text(`MediStock ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Date range: ${dateRange.start || 'All'} to ${dateRange.end || 'All'}`, 14, 36);

  doc.setFontSize(12);
  doc.text('Summary', 14, 48);
  doc.setFontSize(10);
  Object.entries(summary).forEach(([key, value], index) => {
    doc.text(`${key}: ${value}`, 14, 58 + index * 7);
  });

  const tableRows = rows.map((row) => ({
    id: row.medicine_id || row._id || '',
    name: row.medicine_name || row.name || '',
    batch: row.batch_number || row.batch || '',
    stock: row.stock_quantity ?? row.stock ?? '',
    expiry: row.expiry_date || row.expiry || '',
  }));

  autoTable(doc, {
    startY: 100,
    head: [['ID', 'Name', 'Batch', 'Stock', 'Expiry']],
    body: tableRows.map((row) => [row.id, row.name, row.batch, row.stock, row.expiry]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 165, 233] },
  });

  return doc.output('blob');
}

export function Reports() {
  const [reportType, setReportType] = useState('inventory');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    document.title = 'Reports - MediStock';

    const load = async () => {
      try {
        const { data } = await apiClient.get('/medicines');
        setMedicines(data?.data || []);
      } catch (err) {
        console.error('Failed to load report source data', err);
        setError('Unable to load medicines for report generation.');
      }
    };

    load();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const summary = useMemo(() => summarizeMedicines(medicines), [medicines]);

  const previewRows = useMemo(() => medicines.slice(0, 40), [medicines]);

  const generateReport = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const blob = await buildPdfBlob(reportType, summary, medicines, dateRange);
      const url = URL.createObjectURL(blob);
      setPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setMessage('Report generated successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `medistock_${reportType}_${Date.now()}.pdf`;
    link.click();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Reports</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Working report viewer</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Reports are generated from the local medicines dataset so the page works without a separate report API.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generateReport}
              disabled={loading || medicines.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <BarChart3 className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate report'}
            </button>
            <button
              onClick={downloadPdf}
              disabled={!pdfUrl}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Report type</p>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          >
            <option value="inventory">Inventory</option>
            <option value="suppliers">Suppliers</option>
            <option value="audit">Audit</option>
          </select>
        </div>

        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Start date</p>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((current) => ({ ...current, start: e.target.value }))}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">End date</p>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((current) => ({ ...current, end: e.target.value }))}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Source rows</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{medicines.length}</p>
        </div>
      </section>

      {error && <Alert type="danger">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[2rem] border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Total medicines</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{summary.totalMedicines}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Total stock</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{summary.totalStock}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Expiring soon</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{summary.expiringSoon}</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Out of stock</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{summary.outOfStock}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">PDF preview</h2>
              <p className="mt-2 text-sm text-muted-foreground">Generate a report and review it here.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              <Calendar className="mr-1 inline h-4 w-4" />
              Local PDF
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-white">
            {pdfUrl ? (
              <iframe title="Report preview" src={pdfUrl} className="h-[780px] w-full" />
            ) : (
              <div className="grid h-[780px] place-items-center px-6 text-center text-sm text-muted-foreground">
                Click "Generate report" to create the PDF preview.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-border bg-background p-6 shadow-sm">
            <div className="flex items-center gap-3 text-foreground">
              <Filter className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Report details</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Type: {reportType}</p>
              <p>Rows available: {medicines.length}</p>
              <p>Low stock items: {summary.lowStock}</p>
              <p>Expiring soon: {summary.expiringSoon}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">Preview data</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 10).map((medicine) => (
                    <tr key={medicine._id || medicine.medicine_id} className="border-b border-border/60">
                      <td className="px-4 py-3 text-muted-foreground">{medicine.medicine_id}</td>
                      <td className="px-4 py-3 text-muted-foreground">{medicine.medicine_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{medicine.batch_number || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{medicine.stock_quantity ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Reports;
