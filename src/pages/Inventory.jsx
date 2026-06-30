import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import ReorderModal from '../components/ReorderModal';
import { SmartMedicineEntry } from '../components/SmartMedicineEntry';
import { Download, FileText, RefreshCcw, Plus, Search, UploadCloud } from '../components/Icons';

const formatDisplayDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatExportDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [summary, setSummary] = useState({ totalMedicines: 0, expiringSoon: 0, lowStock: 0, outOfStock: 0, reorderGapCount: 0, reorderGapTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMedicine, setEditMedicine] = useState(null);
  const [reorderMedicine, setReorderMedicine] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const navigate = useNavigate();

  const handleImportUpload = async () => {
    if (!importFile) {
      setImportError('Please select a file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', importFile);
    setImportLoading(true);
    setImportError('');
    setImportResult(null);

    try {
      const { data } = await apiClient.post('/import/bulk-insert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data.data || null);
      setNotification({ type: 'success', message: `Import completed: ${data.data?.inserted || 0} rows inserted.` });
      fetchMedicines();
    } catch (uploadError) {
      console.error('Import failed', uploadError);
      setImportError(uploadError?.response?.data?.message || 'Upload failed.');
    } finally {
      setImportLoading(false);
    }
  };
  const pageSize = 20;

  const fetchMedicines = async () => {
    try {
      const [medicinesResponse, summaryResponse] = await Promise.all([
        apiClient.get('/medicines'),
        apiClient.get('/medicines/summary'),
      ]);
      setMedicines(medicinesResponse.data?.data || []);
      setSummary(summaryResponse.data?.data?.summary || { totalMedicines: 0, expiringSoon: 0, lowStock: 0, outOfStock: 0 });
    } catch (err) {
      console.error('Failed to fetch medicines', err);
      setError('Unable to load inventory data.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    document.title = 'Inventory — MediStock';
    fetchMedicines();
  }, []);

  const filteredMedicines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return medicines;
    return medicines.filter((medicine) =>
      [medicine.medicine_name, medicine.medicine_id, medicine.category]
        .map((value) => String(value ?? '').toLowerCase())
        .some((field) => field.includes(normalized))
    );
  }, [medicines, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / pageSize));
  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredMedicines.slice(startIndex, startIndex + pageSize);
  }, [filteredMedicines, currentPage]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total medicines',
        value: summary.totalMedicines,
        highlight: false,
      },
      {
        label: 'Expiring soon',
        value: summary.expiringSoon,
        highlight: true,
      },
      {
        label: 'Reorder gap items',
        value: summary.reorderGapCount,
        caption: `Gap total: ${summary.reorderGapTotal}`,
        highlight: true,
      },
      {
        label: 'Out of stock',
        value: summary.outOfStock,
        highlight: true,
      },
    ],
    [summary]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleExportCSV = () => {
    setNotification({ type: 'success', message: 'Inventory CSV export started successfully.' });
    const headers = ['ID', 'Name', 'Category', 'Stock', 'Status', 'Expiry'];
    const rows = filteredMedicines.map((medicine) => [
      medicine.medicine_id ?? '',
      medicine.medicine_name ?? '',
      medicine.category ?? '',
      medicine.stock_quantity ?? 0,
      medicine.status ?? '',
      formatExportDate(medicine.expiry_date),
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'medistock_inventory_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ compress: true });
      doc.setFontSize(18);
      doc.text('MediStock Inventory Report', 14, 18);
      doc.setFontSize(10);
      doc.text('Generated from local inventory data.', 14, 26);
      setNotification({ type: 'info', message: 'Building the inventory PDF report, please wait...' });
      // Create an offscreen chart for embedding (top 5 medicines by stock)
      try {
        const Chart = (await import('chart.js/auto')).default || (await import('chart.js/auto'));
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        const top = filteredMedicines.slice(0, 5);
        const labels = top.map((m) => m.medicine_name || m.medicine_id || 'N/A');
        const dataPoints = top.map((m) => m.stock_quantity || 0);
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Stock quantity',
                data: dataPoints,
                backgroundColor: '#38BDF8',
              },
            ],
          },
          options: { responsive: false, animation: false, plugins: { legend: { display: false } } },
        });

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 14, 36, 180, 80);
        // destroy chart if possible
        try { chart.destroy(); } catch (e) {}
      } catch (e) {
        console.warn('Chart embedding failed', e);
      }

      autoTable(doc, {
        startY: 36,
        head: [['ID', 'Name', 'Category', 'Stock', 'Status', 'Expiry Date']],
        body: filteredMedicines.map((medicine) => [
          medicine.medicine_id ?? '',
          medicine.medicine_name ?? '',
          medicine.category ?? '',
          medicine.stock_quantity ?? 0,
          medicine.status ?? '',
          formatExportDate(medicine.expiry_date),
        ]),
        theme: 'grid',
        styles: { fontSize: 8 },
      });
      doc.save('medistock_inventory_report.pdf');
      setNotification({ type: 'success', message: 'Inventory PDF download is ready.' });
    } catch (err) {
      console.error('PDF export failed', err);
      setError('Unable to create PDF report.');
      setNotification({ type: 'danger', message: 'Failed to generate inventory PDF report.' });
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Inventory</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Medicine inventory management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Track medicine stock, expiry, and reorder status with fast local reporting. MediStock aligns pharmacy procurement, shelf mapping, expiry controls, billing, and inventory movement in one dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExportPDF} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
            <button onClick={handleExportCSV} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={() => setShowImportModal(true)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5">
              <UploadCloud className="h-4 w-4" />
              Import CSV/XLSX
            </button>
            <button onClick={() => {
              setSyncing(true);
              setNotification({ type: 'info', message: 'Refreshing inventory records...' });
              fetchMedicines();
            }} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/5">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button onClick={() => {
              setNotification({ type: 'info', message: 'Opening medicine entry modal...' });
              setShowAddModal(true);
            }} className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/90">
              <Plus className="h-4 w-4" />
              Add medicine
            </button>
          </div>
        </div>
        {notification && (
          <div className="mt-6">
            <Alert type={notification.type} title={notification.type === 'danger' ? 'Notice' : undefined}>
              {notification.message}
            </Alert>
          </div>
        )}
        {error && <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{error}</div>}
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className={`mt-3 text-3xl font-semibold ${card.highlight ? 'text-sky-600' : 'text-foreground'}`}>
                {card.value}
              </p>
              {card.caption ? (
                <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">{card.caption}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Search</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Search medicines</h2>
          </div>
          <div className="flex w-full items-center gap-3 rounded-3xl border border-border bg-background px-4 py-3 lg:w-1/2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, ID, or category"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-background/80 text-slate-500">
              <tr>
                <th className="px-4 py-4 font-medium">ID</th>
                <th className="px-4 py-4 font-medium">Name</th>
                <th className="px-4 py-4 font-medium">Category</th>
                <th className="px-4 py-4 font-medium">Stock</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading inventory...</td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No medicines found.</td>
                </tr>
              ) : (
                pageItems.map((medicine) => {
                  const statusClass =
                    medicine.status === 'Out of Stock'
                      ? 'border-sky-200 bg-sky-50 text-sky-800'
                      : medicine.status === 'Low Stock'
                      ? 'border-sky-200 bg-sky-100 text-sky-800'
                      : 'border-sky-200 bg-sky-100 text-sky-800';
                  return (
                    <tr key={medicine._id ?? medicine.medicine_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-medium">{medicine.medicine_id}</td>
                      <td className="px-4 py-4 text-muted-foreground">{medicine.medicine_name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{medicine.category}</td>
                      <td className="px-4 py-4 font-semibold text-foreground">{medicine.stock_quantity}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          {medicine.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDisplayDate(medicine.expiry_date)}</td>
                      <td className="px-4 py-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditMedicine(medicine);
                            setShowAddModal(true);
                          }}
                          className="rounded-2xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Delete this medicine?')) return;
                            try {
                              setSyncing(true);
                              await apiClient.delete(`/medicines/${medicine._id}`);
                              setNotification({ type: 'success', message: 'Medicine removed from inventory.' });
                              fetchMedicines();
                            } catch (err) {
                              console.error('Delete failed', err);
                              setNotification({ type: 'danger', message: 'Unable to delete medicine.' });
                            } finally {
                              setSyncing(false);
                            }
                          }}
                          className="rounded-2xl border border-border bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setReorderMedicine(medicine)}
                          className="rounded-2xl border border-border bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          Reorder
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <p>Showing {pageItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(filteredMedicines.length, currentPage * pageSize)} of {filteredMedicines.length} medicines</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="rounded-2xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="rounded-2xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {showAddModal && (
        <SmartMedicineEntry
          onClose={() => {
            setShowAddModal(false);
            setEditMedicine(null);
          }}
          onSuccess={() => {
            fetchMedicines();
            setNotification({ type: 'success', message: 'New medicine saved successfully.' });
            setEditMedicine(null);
          }}
          initialData={editMedicine}
        />
      )}
      {reorderMedicine && (
        <ReorderModal
          open={!!reorderMedicine}
          onClose={() => setReorderMedicine(null)}
          medicine={reorderMedicine}
          onSuccess={(qty) => {
            setNotification({ type: 'success', message: `Reorder request submitted (${qty} units).` });
            fetchMedicines();
          }}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold">Import Medicine Inventory</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                  setImportError('');
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {!importResult ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-500">
                  Select a CSV or XLSX file containing medicine data. The file must match columns such as ID, Name, Category, Stock, and Expiry.
                </p>
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportError('');
                    }}
                    className="mt-4 w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                  />
                  {importFile && (
                    <p className="mt-2 text-xs text-muted-foreground font-semibold">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                {importError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    {importError}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportError('');
                    }}
                    className="rounded-xl border border-border bg-background px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportUpload}
                    disabled={importLoading || !importFile}
                    className="rounded-xl bg-primary px-4 py-2 text-sm text-white font-semibold disabled:opacity-50"
                  >
                    {importLoading ? 'Importing...' : 'Upload & Process'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                  <p className="font-semibold">Import completed successfully!</p>
                  <p className="mt-1">{importResult.inserted} rows inserted. {importResult.failed} rows failed.</p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                      setImportError('');
                      navigate('/predictions?run=true');
                    }}
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                  >
                    Run Forecast & Predictions on Imported Data
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                      setImportError('');
                    }}
                    className="w-full rounded-xl border border-border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Back to Inventory List
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
