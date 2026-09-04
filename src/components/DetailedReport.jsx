import { useEffect, useState } from 'react';
import { apiClient } from '../api/axios';
import { drawLetterhead, finalizeFooters, LETTERHEAD_HEIGHT, LETTERHEAD_MARGIN } from '../utils/pdfBrand';

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

      const reportTitle = 'Detailed Inventory Report';
      const subtitle = `Generated ${new Date().toLocaleString()}  ·  Range ${start || 'All time'} – ${end || 'All time'}`;

      // One cohesive cover — the letterhead band plus a single summary
      // block underneath it — replaces the old back-to-back title page +
      // separate "Key insights summary" page, which read as two different
      // headers for the same report.
      let cursorY = drawLetterhead(doc, { reportTitle, subtitle });
      cursorY += 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text('Key insights summary', LETTERHEAD_MARGIN, cursorY);
      cursorY += 20;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Total matched rows: ${rows.length}`, LETTERHEAD_MARGIN, cursorY);
      cursorY += 16;
      doc.text(`Total columns: ${rows[0] ? Object.keys(rows[0]).length : 0}`, LETTERHEAD_MARGIN, cursorY);
      cursorY += 26;

      const introLines = doc.splitTextToSize(
        'This report includes inventory status, demand prediction analysis, expiry risk, and reorder guidance. The following pages review inventory items, predictions, and actionable reorder guidance.',
        doc.internal.pageSize.getWidth() - LETTERHEAD_MARGIN * 2
      );
      doc.text(introLines, LETTERHEAD_MARGIN, cursorY);

      const addDataPages = () => {
        if (!rows.length) return;
        const chunkSize = 12;
        const chunks = Math.ceil(rows.length / chunkSize);
        for (let pageIndex = 0; pageIndex < chunks; pageIndex += 1) {
          doc.addPage();
          drawLetterhead(doc, { reportTitle, subtitle: 'Inventory data' });
          const startRow = pageIndex * chunkSize;
          const chunk = rows.slice(startRow, startRow + chunkSize);
          autoTable(doc, {
            startY: LETTERHEAD_HEIGHT + 18,
            margin: { top: LETTERHEAD_HEIGHT + 14, left: LETTERHEAD_MARGIN, right: LETTERHEAD_MARGIN, bottom: 34 },
            head: [Object.keys(chunk[0] || {}).slice(0, 6)],
            body: chunk.map((row) => Object.values(row).slice(0, 6).map((value) => String(value ?? ''))),
            theme: 'striped',
            styles: { fontSize: 8, textColor: [30, 41, 59] },
            headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255] },
            didDrawPage: () => drawLetterhead(doc, { reportTitle, subtitle: 'Inventory data' }),
          });
        }
      };

      const addNarrativeSections = () => {
        const sections = [
          { heading: 'Executive summary', body: 'The report provides inventory planning context, demand signals, and expiry risk assessments for the selected data.' },
          { heading: 'Inventory health', body: 'Review stock availability and identify products with low stock or potential shortage risk.' },
          { heading: 'Demand forecast interpretation', body: 'Predictions are based on inventory and usage patterns and should guide reorder timing.' },
          { heading: 'Expiry risk management', body: 'Track medicines nearing expiry and take action to reduce waste and compliance risk.' },
          { heading: 'Reorder guidance', body: 'Use this report to align ordering frequency, supplier lead time, and safety stock targets.' },
          { heading: 'Operational notes', body: 'Ensure forecasting output is reviewed by inventory managers before ordering.' },
          { heading: 'Risk summary', body: 'Highlight critical items with urgent reorder recommendation or high expiry risk.' },
          { heading: 'Compliance notes', body: 'Maintain records for regulatory review and internal audit of stock decisions.' },
          { heading: 'Performance drivers', body: 'Identify seasonal or demand-driven items that may require adjustment.' },
          { heading: 'Action plan', body: 'Summarize decisions for restocking, review, or redistribution across sites.' },
        ];

        let section = 0;
        while (doc.getNumberOfPages() < 30) {
          doc.addPage();
          const y = drawLetterhead(doc, { reportTitle, subtitle: 'Analysis notes' });
          const entry = sections[section % sections.length];
          section += 1;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(30, 41, 59);
          doc.text(entry.heading, LETTERHEAD_MARGIN, y + 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          const textLines = doc.splitTextToSize(entry.body, doc.internal.pageSize.getWidth() - LETTERHEAD_MARGIN * 2);
          doc.text(textLines, LETTERHEAD_MARGIN, y + 34);
          doc.text('Recommendation: Integrate this section with your next purchase cycle and inventory review meeting.', LETTERHEAD_MARGIN, y + 34 + textLines.length * 13 + 16);
        }
      };

      addDataPages();
      addNarrativeSections();
      finalizeFooters(doc);
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
      <div className="relative z-10 mx-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between bg-primary px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Detailed Report</h3>
          <button onClick={onClose} className="text-sm text-emerald-100 hover:text-white">Close</button>
        </div>

        <div className="p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Start date</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End date</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-foreground" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setStart(''); setEnd(''); }} className="ml-auto text-sm text-muted-foreground">Clear</button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex gap-2">
            <button disabled={loading} onClick={downloadJSON} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Download JSON</button>
            <button disabled={loading} onClick={downloadCSV} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">Download CSV</button>
            <button disabled={loading} onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Download PDF</button>
            <div className="ml-auto text-sm text-muted-foreground">{loading ? 'Loading…' : `${rows.length} rows`}</div>
          </div>
        </div>

        <div className="mt-4 max-h-64 overflow-auto rounded-lg border bg-white p-3 text-sm">
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
                      <td key={k} className="px-2 py-1 text-foreground">{String(r[k] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
