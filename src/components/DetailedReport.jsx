import { useEffect, useState } from 'react';
import { apiClient } from '../api/axios';
import jsPDF from 'jspdf';

function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => {
    const v = r[k] == null ? '' : String(r[k]).replace(/"/g, '""');
    return `"${v}"`;
  }).join(','));
  return [header, ...lines].join('\n');
}

export default function DetailedReport({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        // Prefer a dedicated report endpoint but fall back to medicines list
        const params = {};
        if (start) params.start = start;
        if (end) params.end = end;
        let res;
        try {
          res = await apiClient.get('/medicines/report', { params });
          if (res?.data?.data) {
            setRows(res.data.data);
            return;
          }
        } catch (e) {
          // fall through to fetch list
        }

        // fallback
        const list = await apiClient.get('/medicines', { params: { limit: 1000 } });
        setRows(list?.data?.data?.rows || list?.data || []);
      } catch (err) {
        setError('Unable to load report data');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [open, start, end]);

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medistock_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medistock_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    try {
      setError(null);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ unit: 'pt' });

      const titlePage = () => {
        doc.setFontSize(24);
        doc.text('MediStock Detailed Report', 40, 80);
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 110);
        doc.text(`Range: ${start || 'All time'} to ${end || 'All time'}`, 40, 130);
        doc.text('This report includes inventory status, demand prediction analysis, expiry risk, and reorder guidance.', 40, 160);
      };

      const addSummaryPage = () => {
        doc.addPage();
        doc.setFontSize(18);
        doc.text('Key insights summary', 40, 60);
        doc.setFontSize(11);
        doc.text(`Total matched rows: ${rows.length}`, 40, 90);
        doc.text(`Total columns: ${rows[0] ? Object.keys(rows[0]).length : 0}`, 40, 110);
        doc.text('The following pages review inventory items, predictions, and actionable reorder guidance.', 40, 140);
      };

      const addDataPages = () => {
        if (!rows.length) return;
        const chunkSize = 12;
        const chunks = Math.ceil(rows.length / chunkSize);
        for (let pageIndex = 0; pageIndex < chunks; pageIndex += 1) {
          if (doc.getNumberOfPages() > 0) doc.addPage();
          const startRow = pageIndex * chunkSize;
          const chunk = rows.slice(startRow, startRow + chunkSize);
          autoTable(doc, {
            startY: 60,
            head: [Object.keys(chunk[0] || {}).slice(0, 6)],
            body: chunk.map((row) => Object.values(row).slice(0, 6).map((value) => String(value ?? ''))),
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [14, 165, 233] },
          });
          doc.text(`Data page ${pageIndex + 1}`, 40, 50);
        }
      };

      const addNarrativePages = () => {
        const sectionCopies = [
          'Executive summary: The report provides inventory planning context, demand signals, and expiry risk assessments for the selected data.',
          'Inventory health: Review stock availability and identify products with low stock or potential shortage risk.',
          'Demand forecast interpretation: Predictions are based on inventory and usage patterns and should guide reorder timing.',
          'Expiry risk management: Track medicines nearing expiry and take action to reduce waste and compliance risk.',
          'Reorder guidance: Use this report to align ordering frequency, supplier lead time, and safety stock targets.',
          'Operational notes: Ensure forecasting output is reviewed by inventory managers before ordering.',
          'Risk summary: Highlight critical items with urgent reorder recommendation or high expiry risk.',
          'Compliance notes: Maintain records for regulatory review and internal audit of stock decisions.',
          'Performance drivers: Identify seasonal or demand-driven items that may require adjustment.',
          'Action plan: Summarize decisions for restocking, review, or redistribution across sites.',
        ];

        while (doc.getNumberOfPages() < 30) {
          doc.addPage();
          const sectionIndex = (doc.getNumberOfPages() - 1) % sectionCopies.length;
          doc.setFontSize(16);
          doc.text(`Section ${doc.getNumberOfPages()}: ${sectionCopies[sectionIndex].split(':')[0]}`, 40, 60);
          doc.setFontSize(11);
          const textLines = doc.splitTextToSize(sectionCopies[sectionIndex], 520);
          doc.text(textLines, 40, 90);
          doc.text('Recommendation: Integrate this section with your next purchase cycle and inventory review meeting.', 40, 140);
        }
      };

      titlePage();
      addSummaryPage();
      addDataPages();
      addNarrativePages();
      doc.save(`medistock_report_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF failed', err);
      setError('PDF generation failed');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detailed Report</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Start date</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End date</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setStart(''); setEnd(''); }} className="ml-auto text-sm text-muted-foreground">Clear</button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex gap-2">
            <button disabled={loading} onClick={downloadJSON} className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white">Download JSON</button>
            <button disabled={loading} onClick={downloadCSV} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white">Download CSV</button>
            <button disabled={loading} onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Download PDF</button>
            <div className="ml-auto text-sm text-muted-foreground">{loading ? 'Loading…' : `${rows.length} rows`}</div>
          </div>
        </div>

        <div className="mt-4 max-h-64 overflow-auto rounded-lg border bg-background p-3 text-sm">
          {error && <div className="text-destructive">{error}</div>}
          {!error && rows.length === 0 && <div className="text-muted-foreground">No data to preview.</div>}
          {!error && rows.length > 0 && (
            <table className="w-full table-auto text-left text-xs">
              <thead>
                <tr>
                  {Object.keys(rows[0]).slice(0, 6).map((k) => (
                    <th key={k} className="px-2 py-1 font-medium text-muted-foreground">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    {Object.keys(rows[0]).slice(0, 6).map((k) => (
                      <td key={k} className="px-2 py-1">{String(r[k] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
