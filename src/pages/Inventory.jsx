import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { SmartMedicineEntry } from '../components/SmartMedicineEntry';
import TransactionModal from '../components/TransactionModal';
import { Download, FileText, RefreshCcw, Plus, Search, UploadCloud, ShoppingCart } from '../components/Icons';
import { useSelector } from 'react-redux';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCart } from '../context/CartContext';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { formatMoney } from '../utils/money';
import { drawLetterhead, finalizeFooters, LETTERHEAD_HEIGHT, LETTERHEAD_MARGIN } from '../utils/pdfBrand';

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
  const { settings } = useAppSettings();
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
  const [importInvalidFormat, setImportInvalidFormat] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const navigate = useNavigate();
  const role = useSelector((s) => s.auth.user?.role || 'User');
  const { addToCart } = useCart();
  const currency = settings.currencySymbol;

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
    setImportInvalidFormat(false);
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
      setImportInvalidFormat(!!uploadError?.response?.data?.invalidFormat);
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
    setImportInvalidFormat(false);
    setImportResult(null);

    try {
      const { data } = await apiClient.post('/import/process-upload', { filename });
      setImportResult(data.data || null);
      setNotification({ type: 'success', message: `Stored upload processed: ${data.data?.inserted || 0} rows inserted. Converted to JSON (${data.data?.json_file || ''}) and the source file was removed.` });
      fetchMedicines();
    } catch (uploadError) {
      console.error('Process stored upload failed', uploadError);
      setImportError(uploadError?.response?.data?.message || 'Processing stored upload failed.');
      setImportInvalidFormat(!!uploadError?.response?.data?.invalidFormat);
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
    setImportInvalidFormat(false);
    setImportResult(null);

    try {
      const { data } = await apiClient.post('/import/bulk-insert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data.data || null);
      setNotification({ type: 'success', message: `Import completed: ${data.data?.inserted || 0} rows inserted. Converted to JSON (${data.data?.json_file || ''}) and the source Excel file was removed.` });
      fetchMedicines();
    } catch (uploadError) {
      console.error('Import failed', uploadError);
      setImportError(uploadError?.response?.data?.message || 'Upload failed.');
      setImportInvalidFormat(!!uploadError?.response?.data?.invalidFormat);
    } finally {
      setImportLoading(false);
    }
  };
  const handleSyncPrices = async () => {
    setSyncingPrices(true);
    setNotification({ type: 'info', message: 'Syncing selling prices from the reference sheet into the database...' });
    try {
      const { data } = await apiClient.post('/medicines/backfill-prices', {});
      const updated = data?.data?.updated ?? 0;
      setNotification({
        type: updated > 0 ? 'success' : 'info',
        message: updated > 0
          ? `Updated selling price directly in the database for ${updated} medicine(s). Refreshing inventory...`
          : 'All medicines already have a selling price — nothing to update.',
      });
      fetchMedicines();
    } catch (err) {
      console.error('Price sync failed', err);
      setNotification({ type: 'danger', message: err?.response?.data?.message || 'Unable to sync prices from the reference sheet.' });
    } finally {
      setSyncingPrices(false);
    }
  };

  const pageSize = settings.defaultPageSize || 20;
  const actionBtnBase = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold';

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

  // Auto-dismiss the toast-style notification banner (add to cart, delete,
  // export, etc.) after a few seconds instead of leaving it on screen
  // until the next action replaces it.
  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

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
      {
        label: 'Low stock',
        value: summary.lowStock,
        highlight: summary.lowStock > 0,
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
    const headers = ['ID', 'Name', 'Stock', 'Price', 'Status', 'Expiry'];
    const rows = filteredMedicines.map((medicine) => [
      medicine.medicine_id ?? '',
      medicine.medicine_name ?? '',
      medicine.stock_quantity ?? 0,
      formatMoney(currency, medicine.unit_price),
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
      const doc = new jsPDF({ compress: true, unit: 'pt', format: 'a4' });
      setNotification({ type: 'info', message: 'Building the inventory PDF report, please wait...' });

      const lowStock = filteredMedicines.filter((medicine) => {
        const stock = Number(medicine.stock_quantity || 0);
        return stock > 0 && stock <= (settings.lowStockThreshold || 10);
      }).length;
      const expiringSoon = filteredMedicines.filter((medicine) => {
        if (!medicine.expiry_date) return false;
        const days = Math.ceil((new Date(medicine.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= (settings.expiryAlertDays || 30);
      }).length;
      const reportSummary = {
        title: 'Inventory report',
        totalMedicines: filteredMedicines.length,
        totalStock: filteredMedicines.reduce((sum, medicine) => sum + Number(medicine.stock_quantity || 0), 0),
        lowStock,
        outOfStock: filteredMedicines.filter((medicine) => Number(medicine.stock_quantity || 0) === 0).length,
        expiringSoon,
      };
      const reportColumns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'batch', label: 'Batch' },
        { key: 'stock', label: 'Stock' },
        { key: 'expiry', label: 'Expiry' },
      ];
      const reportRows = filteredMedicines.map((medicine) => ({
        id: medicine.medicine_id || medicine._id || '',
        name: medicine.medicine_name || '',
        batch: medicine.batch_number || '',
        stock: medicine.stock_quantity ?? '',
        expiry: medicine.expiry_date ? new Date(medicine.expiry_date).toLocaleDateString() : '',
      }));
      const reportTitle = 'Inventory Report';
      const subtitle = `Generated ${new Date().toLocaleString()} | ${filteredMedicines.length} records`;
      let cursorY = drawLetterhead(doc, { reportTitle, subtitle });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('Summary', LETTERHEAD_MARGIN, cursorY);
      cursorY += 8;
      const summaryEntries = Object.entries(reportSummary).filter(([key]) => key !== 'title');
      const summaryColumnWidth = (doc.internal.pageSize.getWidth() - LETTERHEAD_MARGIN * 2) / 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      summaryEntries.forEach(([key, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
        doc.setTextColor(100, 116, 139);
        doc.text(label, LETTERHEAD_MARGIN + column * summaryColumnWidth, cursorY + row * 14);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value), LETTERHEAD_MARGIN + column * summaryColumnWidth + 100, cursorY + row * 14);
        doc.setFont('helvetica', 'normal');
      });
      cursorY += Math.ceil(summaryEntries.length / 2) * 14 + 10;

      autoTable(doc, {
        startY: cursorY,
        margin: { top: LETTERHEAD_HEIGHT + 14, left: LETTERHEAD_MARGIN, right: LETTERHEAD_MARGIN, bottom: 34 },
        head: [reportColumns.map((column) => column.label)],
        body: reportRows.map((row) => reportColumns.map((column) => row[column.key] ?? '')),
        styles: { fontSize: 8, textColor: [30, 41, 59] },
        headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        didDrawPage: () => {
          drawLetterhead(doc, { reportTitle, subtitle });
        },
      });
      finalizeFooters(doc);
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
      <PageHeader
        title="Medicine inventory management"
        description="Track medicine stock, expiry, and inventory status with fast local reporting — procurement, shelf mapping, expiry controls, and inventory movement in one dashboard."
        image={PAGE_IMAGES.pharmacyShelf}
        imageAlt="Stocked pharmacy medicine shelf"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/cart')} className={`${actionBtnBase} bg-amber-400 text-emerald-950 hover:bg-amber-300`}>
              <ShoppingCart className="h-4 w-4" />
              Go to Cart
            </button>
            <button onClick={handleExportPDF} className={`${actionBtnBase} bg-white text-emerald-700 hover:bg-emerald-50`}>
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
            <button onClick={handleExportCSV} className={`${actionBtnBase} bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15`}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {['Admin', 'Manager'].includes(role) && (
              <button onClick={() => setShowImportModal(true)} className={`${actionBtnBase} bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15`}>
                <UploadCloud className="h-4 w-4" />
                Import CSV/XLSX
              </button>
            )}
            {['Admin', 'Manager'].includes(role) && (
              <button
                onClick={handleSyncPrices}
                disabled={syncingPrices}
                title="Fix medicines that are missing a selling price by matching them against the reference price sheet, updating MongoDB directly."
                className={`${actionBtnBase} bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <RefreshCcw className="h-4 w-4" />
                {syncingPrices ? 'Syncing prices...' : 'Sync Missing Prices'}
              </button>
            )}

            <button onClick={() => {
              setSyncing(true);
              setNotification({ type: 'info', message: 'Refreshing inventory records...' });
              fetchMedicines();
            }} className={`${actionBtnBase} bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15`}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            {['Admin', 'Manager', 'User'].includes(role) && (
              <button onClick={() => {
                setNotification({ type: 'info', message: 'Opening medicine entry modal...' });
                setShowAddModal(true);
              }} className={`${actionBtnBase} bg-slate-900 text-white hover:bg-slate-800`}>
                <Plus className="h-4 w-4 " />
                Add medicine
              </button>
            )}
          </div>
        }
      />

      {notification && (
        <Alert
          type={notification.type}
          title={notification.title || (notification.type === 'danger' ? 'Notice' : undefined)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{notification.message}</span>
            {notification.cart && (
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
              >
                View cart
              </button>
            )}
          </div>
        </Alert>
      )}
      {error && <Alert type="danger">{error}</Alert>}
      {latestStoredUpload && (
        <div className="panel-accent flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" data-accent="teal">
          <div>
            <p className="eyebrow-tag">Pending stored import</p>
            <p className="mt-1 font-semibold text-foreground">{latestStoredUpload.originalName}</p>
            <p className="text-sm text-muted-foreground">Uploaded {new Date(latestStoredUpload.uploadedAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {['Admin', 'Manager'].includes(role) && (
              <button
                type="button"
                onClick={() => handleProcessStoredUpload(latestStoredUpload.filename)}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Process stored file
              </button>
            )}
            {role === 'Admin' && (
              <button
                type="button"
                onClick={() => handleDeleteStoredUpload(latestStoredUpload.filename)}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Remove stored file
              </button>
            )}
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
          <Reveal key={card.label} delay={index * 60}>
          <div className="stat-tile" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: card.highlight ? '#059669' : '#CBD5E1' }}>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${card.highlight ? 'text-emerald-600' : 'text-foreground'}`}>
                {card.value}
              </p>
              {card.caption ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{card.caption}</p>
              ) : null}
            </div>
          </div>
          </Reveal>
        ))}
      </section>

      {batchSegments.length > 0 && (
        <section className="panel-accent p-6" data-accent="teal">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow-tag">Batch segmentation</p>
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
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">FEFO</span>
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

      <section className="panel-accent p-6" data-accent="sky">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow-tag">Inventory directory</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Find a medicine</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search by medicine name or internal ID to manage stock and billing.</p>
          </div>
          <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm lg:w-[min(100%,34rem)]">
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

      <section className="overflow-hidden panel">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <p className="eyebrow-tag">Stock register</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Current medicines</h2>
          </div>
          <p className="text-sm text-muted-foreground">{filteredMedicines.length} matching record{filteredMedicines.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-emerald-50/70 text-slate-600">
              <tr>
                <th className="px-4 py-4 font-medium">ID</th>
                <th className="px-4 py-4 font-medium">Name</th>
                <th className="px-4 py-4 font-medium">Stock</th>
                <th className="px-4 py-4 font-medium">Price</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Expiry</th>
                <th className="px-4 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading inventory...</td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No medicines found.</td>
                </tr>
              ) : (
                pageItems.map((medicine) => {
                  const statusClass =
                    medicine.status === 'Out of Stock'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : medicine.status === 'Low Stock'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                      : 'border-emerald-200 bg-emerald-100 text-emerald-800';
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
                      <td className="px-4 py-4 font-semibold text-foreground">
                        {medicine.unit_price > 0 ? (
                          formatMoney(currency, medicine.unit_price)
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" title="No selling price set — edit this medicine or use Sync Missing Prices.">
                            Not set
                          </span>
                        )}
                      </td>
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
                          onClick={() => {
                            if (!medicine.unit_price || medicine.unit_price <= 0) {
                              setNotification({ type: 'danger', message: `${medicine.medicine_name} has no selling price set. Edit the medicine to add one before billing it.` });
                              return;
                            }
                            addToCart(medicine, 1);
                            setNotification({ type: 'success', title: 'Added to cart', message: `${medicine.medicine_name} is ready for billing.`, cart: true });
                          }}
                          disabled={!medicine.stock_quantity || medicine.stock_quantity <= 0}
                          title="Add to cart for billing"
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Add to Cart
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransactionMedicine(medicine)}
                          title="Record same-day stock additions and sales"
                          className="rounded-2xl border border-border bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
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

      <div className="flex flex-wrap items-center justify-between gap-3 panel p-4 text-sm text-muted-foreground">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between bg-primary px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-green">Import Medicine Inventory</h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                  setImportError('');
                  setImportInvalidFormat(false);
                }}
                className="text-emerald-100 hover:text-green text-sm font-semibold text-black"
              >
                Close
              </button>
            </div>

            <div className="p-6">

            {!importResult ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-500">
                  Select a CSV, XLSX, XLS, or JSON file containing medicine data. The header row must include ID, Name, Batch number, and Expiry date columns.
                </p>
                <div className="panel-outline p-6 text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportError('');
                      setImportInvalidFormat(false);
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
                  <Alert
                    type={importInvalidFormat ? 'warning' : 'danger'}
                    title={importInvalidFormat ? 'Invalid file format — file kept for review' : 'Upload failed'}
                  >
                    {importError}
                  </Alert>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleImportUpload}
                    disabled={importLoading || !importFile}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {importLoading ? 'Validating & importing...' : 'Upload & Import'}
                  </button>
                </div>

                <details className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground">Advanced: stage a file without importing it yet</summary>
                  <div className="mt-3 space-y-3">
                    <p>Save the file to the server without validating or inserting it, and process it later from this screen.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={handleStoreUpload}
                        disabled={importLoading || !importFile}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground disabled:opacity-50"
                      >
                        {importLoading ? 'Saving...' : 'Store file only'}
                      </button>
                      <button
                        onClick={() => handleProcessStoredUpload()}
                        disabled={importLoading || !latestStoredUpload}
                        className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground disabled:opacity-50"
                      >
                        {importLoading ? 'Processing...' : 'Process stored file'}
                      </button>
                    </div>
                    {storedUploadResult && (
                      <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                        {storedUploadResult.originalName} is staged and ready to process.
                      </p>
                    )}
                  </div>
                </details>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Alert type="success" title="Import completed successfully">
                  The file was parsed and processed — see the breakdown below.
                </Alert>

                <table className="w-full overflow-hidden rounded-xl border border-border text-sm">
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="bg-muted/40 px-4 py-2.5 font-semibold text-foreground">Rows detected</td>
                      <td className="px-4 py-2.5 text-foreground">{importResult.total_rows ?? importResult.inserted}</td>
                    </tr>
                    <tr>
                      <td className="bg-muted/40 px-4 py-2.5 font-semibold text-foreground">Rows inserted</td>
                      <td className="px-4 py-2.5 text-emerald-700 font-semibold">{importResult.inserted}</td>
                    </tr>
                    <tr>
                      <td className="bg-muted/40 px-4 py-2.5 font-semibold text-foreground">Rows skipped</td>
                      <td className="px-4 py-2.5 text-foreground">{importResult.failed || 0}</td>
                    </tr>
                    {importResult.json_file && (
                      <tr>
                        <td className="bg-muted/40 px-4 py-2.5 font-semibold text-foreground">Saved as</td>
                        <td className="px-4 py-2.5 text-foreground font-mono text-xs">{importResult.json_file}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                      setImportError('');
                      setImportInvalidFormat(false);
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
                      setImportInvalidFormat(false);
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
        </div>
      )}
    </div>
  );
}
