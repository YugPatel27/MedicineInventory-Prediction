import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { SmartMedicineEntry } from '../components/SmartMedicineEntry';
import TransactionModal from '../components/TransactionModal';
import { Download, FileText, RefreshCcw, Plus, Search, UploadCloud } from '../components/Icons';
import { useSelector } from 'react-redux';

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
  const [summary, setSummary] = useState({ totalMedicines: 0, expiringSoon: 0, lowStock: 0, outOfStock: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMedicine, setEditMedicine] = useState(null);
  const [transactionMedicine, setTransactionMedicine] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [latestStoredUpload, setLatestStoredUpload] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [storedUploadResult, setStoredUploadResult] = useState(null);
  const [importError, setImportError] = useState('');
  const navigate = useNavigate();
  const role = useSelector((s) => s.auth.user?.role || 'User');

  const fetchLatestStoredUpload = async () => {
    try {
      const { data } = await apiClient.get('/import/uploads/latest');
      setLatestStoredUpload(data.data?.latest || null);
    } catch (err) {
      console.warn('Unable to load latest stored upload', err);
      setLatestStoredUpload(null);
    }
  };

  const handleDeleteStoredUpload = async (filename) => {
    if (!filename) return;
    if (!window.confirm('Remove stored uploaded file? This cannot be undone.')) return;
    try {
      setImportLoading(true);
      await apiClient.delete(`/import/uploads/${filename}`);
      setNotification({ type: 'success', message: 'Stored upload removed.' });
      setLatestStoredUpload(null);
      setStoredUploadResult(null);
      fetchLatestStoredUpload();
    } catch (err) {
      console.error('Delete stored upload failed', err);
      setNotification({ type: 'danger', message: err?.response?.data?.message || 'Unable to remove stored upload.' });
    } finally {
      setImportLoading(false);
    }
  };

  const handleStoreUpload = async () => {
    if (!importFile) {
      setImportError('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);
    setImportLoading(true);
    setImportError('');
    setImportResult(null);
    setStoredUploadResult(null);

    try {
      const { data } = await apiClient.post('/import/store-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStoredUploadResult(data.data || null);
      setLatestStoredUpload(data.data || null);
      setNotification({ type: 'success', message: 'File stored successfully and is available in inventory.' });
    } catch (uploadError) {
      console.error('Store upload failed', uploadError);
      setImportError(uploadError?.response?.data?.message || 'Store upload failed.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleProcessStoredUpload = async (filename = latestStoredUpload?.filename) => {
    if (!filename) {
      setImportError('No stored upload is available to process.');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportResult(null);

    try {
      const { data } = await apiClient.post('/import/process-upload', { filename });
      setImportResult(data.data || null);
      setNotification({ type: 'success', message: `Stored upload processed: ${data.data?.inserted || 0} rows inserted.` });
      fetchMedicines();
    } catch (uploadError) {
      console.error('Process stored upload failed', uploadError);
      setImportError(uploadError?.response?.data?.message || 'Processing stored upload failed.');
    } finally {
      setImportLoading(false);
    }
  };

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
  const actionBtnBase = 'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold';

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
    fetchLatestStoredUpload();
  }, []);

  const filteredMedicines = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return medicines;
    return medicines.filter((medicine) =>
      [medicine.medicine_name, medicine.medicine_id]
        .map((value) => String(value ?? '').toLowerCase())
        .some((field) => field.includes(normalized))
    );
  }, [medicines, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / pageSize));
  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredMedicines.slice(startIndex, startIndex + pageSize);
  }, [filteredMedicines, currentPage]);

  const batchSegments = useMemo(() => {
    const grouped = medicines.reduce((acc, medicine) => {
      const key = String(medicine.medicine_id || medicine.medicine_name || 'unknown');
      if (!acc[key]) acc[key] = [];
      acc[key].push(medicine);
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, entries]) => {
      const sorted = [...entries].sort((a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0));
      return {
        key,
        items: sorted,
        earliestExpiry: sorted[0],
      };
    }).slice(0, 6);
  }, [medicines]);

  const getBatchAgeColor = (medicine) => {
    const expiryDate = medicine.expiry_date ? new Date(medicine.expiry_date) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return 'border-slate-200 bg-slate-50 text-slate-700';
    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 30) return 'border-rose-200 bg-rose-50 text-rose-800';
    if (daysRemaining <= 90) return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  };

  const getBatchBadge = (medicine) => {
    const expiryDate = medicine.expiry_date ? new Date(medicine.expiry_date) : null;
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) return '—';
    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 30) return 'Critical';
    if (daysRemaining <= 90) return 'Watch';
    return 'Healthy';
  };

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
    const headers = ['ID', 'Name', 'Stock', 'Status', 'Expiry'];
    const rows = filteredMedicines.map((medicine) => [
      medicine.medicine_id ?? '',
      medicine.medicine_name ?? '',
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
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const addHeaderFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i += 1) {
          doc.setPage(i);
          doc.setFillColor(14, 116, 144);
          doc.rect(0, 0, pageWidth, 24, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.text('MediStock', 14, 14);
          doc.setFontSize(10);
          doc.text('Inventory Report', 68, 14);
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(9);
          doc.text(`Page ${i} of ${pageCount}`, pageWidth - 24, pageHeight - 10);
        }
      };
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text('MediStock Inventory Report', 14, 32);
      doc.setFontSize(10);
      doc.text('Generated from local inventory data.', 14, 40);
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
        startY: 50,
        head: [['ID', 'Name', 'Stock', 'Status', 'Expiry Date']],
        body: filteredMedicines.map((medicine) => [
          medicine.medicine_id ?? '',
          medicine.medicine_name ?? '',
          medicine.stock_quantity ?? 0,
          medicine.status ?? '',
          formatExportDate(medicine.expiry_date),
        ]),
        theme: 'grid',
        styles: { fontSize: 8 },
      });
      addHeaderFooter();
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
              Track medicine stock, expiry, and inventory status with fast local reporting. MediStock aligns pharmacy procurement, shelf mapping, expiry controls, billing, and inventory movement in one dashboard.
            </p>
          </div>
          <div className="flex flex-nowrap items-center gap-3">
            <button onClick={handleExportPDF} className={`${actionBtnBase} bg-primary text-white hover:bg-primary/90`}>
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
            <button onClick={handleExportCSV} className={`${actionBtnBase} border border-border bg-background text-foreground hover:bg-primary/5`}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {['Admin', 'Manager'].includes(role) && (
              <button onClick={() => setShowImportModal(true)} className={`${actionBtnBase} border border-border bg-background text-foreground hover:bg-primary/5`}>
                <UploadCloud className="h-4 w-4" />
                Import CSV/XLSX
              </button>
            )}
            
            <button onClick={() => {
              setSyncing(true);
              setNotification({ type: 'info', message: 'Refreshing inventory records...' });
              fetchMedicines();
            }} className={`${actionBtnBase} border border-border bg-background text-foreground hover:bg-primary/5`}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            {['Admin', 'Manager'].includes(role) && (
              <button onClick={() => {
                setNotification({ type: 'info', message: 'Opening medicine entry modal...' });
                setShowAddModal(true);
              }} className={`${actionBtnBase} bg-secondary text-secondary-foreground hover:bg-secondary/90`}>
                <Plus className="h-4 w-4 " />
                Add medicine
              </button>
            )}
          </div>
        </div>
        {notification && (
          <div className="mt-6">
            <Alert type={notification.type} title={notification.type === 'danger' ? 'Notice' : undefined}>
              {notification.message}
            </Alert>
          </div>
        )}
        {latestStoredUpload && (
          <div className="mt-6 rounded-[2rem] border border-border bg-background p-5 shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Pending stored import</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">{latestStoredUpload.originalName}</p>
                <p className="text-sm text-muted-foreground">Uploaded {new Date(latestStoredUpload.uploadedAt).toLocaleString()}</p>
              </div>
              {['Admin', 'Manager'].includes(role) && (
                <button
                  type="button"
                  onClick={() => handleProcessStoredUpload(latestStoredUpload.filename)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Process stored file
                </button>
              )}
              {role === 'Admin' && (
                <button
                  type="button"
                  onClick={() => handleDeleteStoredUpload(latestStoredUpload.filename)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Remove stored file
                </button>
              )}
            </div>
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

      {batchSegments.length > 0 && (
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Batch segmentation</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Batch groups with FEFO visibility - First Expiry First Out</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {batchSegments.map((segment) => {
              const mainBatch = segment.earliestExpiry;
              return (
                <div key={segment.key} className="rounded-[1.5rem] border border-border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{mainBatch?.medicine_name || segment.key}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{segment.items.length} batches</p>
                    </div>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">FEFO</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {segment.items.map((batch) => (
                      <div key={`${batch._id || batch.medicine_id}-${batch.batch_number}`} className={`rounded-2xl border px-3 py-2 text-sm ${getBatchAgeColor(batch)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{batch.batch_number || 'Batch'} • {batch.stock_quantity} units</span>
                          {batch === mainBatch && <span className="font-semibold">⚠ Dispense First</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-80">
                          <span>Purchase: {formatDisplayDate(batch.purchase_date)}</span>
                          <span>•</span>
                          <span>Mfg: {formatDisplayDate(batch.manufacturing_date)}</span>
                          <span>•</span>
                          <span>Expiry: {formatDisplayDate(batch.expiry_date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
              placeholder="Search by name or ID"
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
                <th className="px-4 py-4 font-medium">Stock</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Expiry</th>
                <th className="px-4 py-4 font-medium">Actions</th>
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
                  const medicineBatchGroup = medicines.filter((item) => String(item.medicine_id || item.medicine_name || '') === String(medicine.medicine_id || medicine.medicine_name || ''));
                  const sortedBatchGroup = [...medicineBatchGroup].sort((a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0));
                  const isFefoBatch = medicineBatchGroup.length > 1 && sortedBatchGroup[0] && (String(sortedBatchGroup[0]._id ?? sortedBatchGroup[0].medicine_id ?? '') === String(medicine._id ?? medicine.medicine_id ?? ''));
                  return (
                    <tr key={medicine._id ?? medicine.medicine_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-medium">{medicine.medicine_id}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          <span>{medicine.medicine_name}</span>
                          {medicine.batch_number && <span className="text-xs text-slate-500">Batch {medicine.batch_number}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-foreground">{medicine.stock_quantity}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                          {medicine.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className={`rounded-2xl border px-3 py-2 text-sm ${getBatchAgeColor(medicine)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{formatDisplayDate(medicine.expiry_date)}</span>
                            <div className="flex items-center gap-2">
                              {isFefoBatch && <span className="text-[11px] font-semibold text-rose-700">⚠ Dispense First</span>}
                              {medicine.batch_number && <span className="text-[11px] font-semibold">{getBatchBadge(medicine)}</span>}
                            </div>
                          </div>
                          {medicine.batch_number && (
                            <div className="mt-1 text-[11px] opacity-80">
                              Purchase {formatDisplayDate(medicine.purchase_date)} • Mfg {formatDisplayDate(medicine.manufacturing_date)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 flex flex-wrap gap-2">
                        {['Admin', 'Manager'].includes(role) && (
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
                        )}
                        {role === 'Admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('Delete this medicine?')) return;
                              try {
                                setSyncing(true);
                                await apiClient.delete(`/medicines/${medicine._id}`);
                                setNotification({ type: 'success', message: 'Medicine removed from inventory.' });
                                fetchMedicines();
                                try { window.dispatchEvent(new CustomEvent('inventory:changed')); } catch (e) {}
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
                        )}
                        <button
                          type="button"
                          onClick={() => setTransactionMedicine(medicine)}
                          title="Record same-day stock additions and sales"
                          className="rounded-2xl border border-border bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Daily Log
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
      {transactionMedicine && (
        <TransactionModal
          medicine={transactionMedicine}
          onClose={() => setTransactionMedicine(null)}
          onSuccess={(result) => {
            // Update local medicines state optimistically using returned transaction result
            if (result) {
              setMedicines((prev) => prev.map((m) => {
                if (!m) return m;
                const matches = (m._id && String(m._id) === String(result.id)) || (m.medicine_id && String(m.medicine_id) === String(result.medicine_id));
                if (!matches) return m;
                return {
                  ...m,
                  stock_quantity: result.final_stock,
                  avg_monthly_consumption: result.updated_consumption ?? m.avg_monthly_consumption,
                  last_updated: new Date().toISOString(),
                  status: result.status ?? m.status,
                };
              }));
              setNotification({ type: 'success', message: 'Daily stock and sales log processed successfully.' });
            } else {
              // Fallback: refresh from server
              fetchMedicines();
              setNotification({ type: 'success', message: 'Daily stock and sales log processed successfully.' });
            }
            setTransactionMedicine(null);
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
                  Select a CSV or XLSX file containing medicine data. The file must match columns such as ID, Name, Stock, and Expiry.
                </p>
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportError('');
                      setStoredUploadResult(null);
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleStoreUpload}
                    disabled={importLoading || !importFile}
                    className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
                  >
                    {importLoading ? 'Saving...' : 'Store Uploaded File'}
                  </button>
                  <button
                    onClick={handleImportUpload}
                    disabled={importLoading || !importFile}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {importLoading ? 'Processing...' : 'Process Uploaded File'}
                  </button>
                </div>

                {storedUploadResult && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Stored file is ready.</p>
                    <p className="mt-1">{storedUploadResult.originalName} has been saved for later processing.</p>
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
