import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  Download,
  Calendar,
  BarChart3,
  Filter,
  Database,
  Box,
  TrendingUp,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock3,
} from '../components/Icons';
import { drawLetterhead, finalizeFooters, LETTERHEAD_HEIGHT, LETTERHEAD_MARGIN } from '../utils/pdfBrand';

// Column definitions for each report type. The same config drives the PDF
// table, the on-screen preview table, and keeps the "shape" of a report tied
// to its type in a single place instead of the table always being rendered
// with medicine-shaped columns regardless of what was picked in the dropdown.
const REPORT_TYPES = {
  inventory: {
    label: 'Inventory',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'batch', label: 'Batch' },
      { key: 'stock', label: 'Stock' },
      { key: 'expiry', label: 'Expiry' },
    ],
  },
  suppliers: {
    label: 'Suppliers',
    columns: [
      { key: 'supplier', label: 'Supplier' },
      { key: 'medicines', label: 'Medicines' },
      { key: 'stockUnits', label: 'Stock units' },
      { key: 'stockValue', label: 'Est. value (Rs.)' },
    ],
  },
  audit: {
    label: 'Audit',
    columns: [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'user', label: 'User' },
      { key: 'role', label: 'Role' },
      { key: 'action', label: 'Action' },
      { key: 'target', label: 'Target' },
    ],
  },
};

// The Medicine model has no supplier/manufacturer field persisted in the
// database, so — same as the Purchases page's own working assumption — each
// medicine is deterministically assigned to one of these suppliers by its
// position in the list. This keeps the Suppliers report consistent across
// generations instead of relying on data that doesn't exist yet.
const SUPPLIER_POOL = ['MedSupply Co', 'PharmaCorp', 'HealthLabs'];

function isWithinDateRange(value, dateRange) {
  if (!dateRange.start && !dateRange.end) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (dateRange.start && time < new Date(dateRange.start).getTime()) return false;
  if (dateRange.end && time > new Date(dateRange.end).getTime() + 86399999) return false;
  return true;
}

function buildInventoryRows(medicines) {
  return medicines.map((medicine) => ({
    id: medicine.medicine_id || medicine._id || '',
    name: medicine.medicine_name || medicine.name || '',
    batch: medicine.batch_number || medicine.batch || '',
    stock: medicine.stock_quantity ?? medicine.stock ?? '',
    expiry: medicine.expiry_date ? new Date(medicine.expiry_date).toLocaleDateString() : '',
  }));
}

function summarizeInventory(medicines, { expiryAlertDays = 30, lowStockThreshold = 10 } = {}) {
  const totalStock = medicines.reduce((sum, medicine) => sum + Number(medicine.stock_quantity || 0), 0);
  const lowStock = medicines.filter((medicine) => Number(medicine.stock_quantity || 0) > 0 && Number(medicine.stock_quantity || 0) <= lowStockThreshold).length;
  const outOfStock = medicines.filter((medicine) => Number(medicine.stock_quantity || 0) === 0).length;
  const expiringSoon = medicines.filter((medicine) => {
    if (!medicine.expiry_date) return false;
    const days = Math.ceil((new Date(medicine.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= expiryAlertDays;
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

function buildSupplierRows(medicines) {
  const groups = new Map();
  medicines.forEach((medicine, index) => {
    const supplier = SUPPLIER_POOL[index % SUPPLIER_POOL.length];
    if (!groups.has(supplier)) groups.set(supplier, { supplier, medicines: 0, stockUnits: 0, stockValue: 0 });
    const group = groups.get(supplier);
    group.medicines += 1;
    group.stockUnits += Number(medicine.stock_quantity || 0);
    group.stockValue += Number(medicine.stock_quantity || 0) * Number(medicine.unit_cost || medicine.unit_price || 0);
  });
  return Array.from(groups.values())
    .sort((a, b) => b.stockValue - a.stockValue)
    .map((group) => ({ ...group, stockValue: Math.round(group.stockValue) }));
}

function summarizeSuppliers(supplierRows, medicineCount) {
  const totalStockValue = supplierRows.reduce((sum, row) => sum + row.stockValue, 0);
  return {
    title: 'Supplier report',
    totalSuppliers: supplierRows.length,
    medicinesCovered: medicineCount,
    avgMedicinesPerSupplier: supplierRows.length ? Math.round(medicineCount / supplierRows.length) : 0,
    estStockValue: totalStockValue,
  };
}

function buildAuditRows(logs) {
  return logs.map((log) => ({
    timestamp: log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt).toLocaleString() : '',
    user: log.userEmail || log.user?.email || 'Unknown',
    role: log.userRole || log.user?.role || '—',
    action: log.action || '',
    target: log.target || '',
  }));
}

function summarizeAudit(logs) {
  const uniqueUsers = new Set(logs.map((log) => log.userEmail || log.user?.email || 'unknown')).size;
  const actionCounts = {};
  logs.forEach((log) => {
    const key = log.action || 'unknown';
    actionCounts[key] = (actionCounts[key] || 0) + 1;
  });
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const adminActions = logs.filter((log) => (log.userRole || log.user?.role) === 'Admin').length;

  return {
    title: 'Audit report',
    totalLogs: logs.length,
    uniqueUsers,
    topAction,
    adminActions,
  };
}

async function buildPdfBlob(reportType, summary, columns, rows, dateRange) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ compress: true, unit: 'pt', format: 'a4' });

  const reportLabel = `${REPORT_TYPES[reportType]?.label || reportType} Report`;
  const rangeLabel = `${dateRange.start || 'All'} – ${dateRange.end || 'All'}`;

  // Single branded letterhead — drawn once here for page 1, and re-drawn
  // identically on every later page by the autoTable hook below, so the
  // report never shows two mismatched headers.
  let cursorY = drawLetterhead(doc, {
    reportTitle: reportLabel,
    subtitle: `Generated ${new Date().toLocaleString()}  ·  Range ${rangeLabel}`,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Summary', LETTERHEAD_MARGIN, cursorY);
  cursorY += 8;

  const summaryEntries = Object.entries(summary).filter(([key]) => key !== 'title');
  const colWidth = (doc.internal.pageSize.getWidth() - LETTERHEAD_MARGIN * 2) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  summaryEntries.forEach(([key, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}`, LETTERHEAD_MARGIN + col * colWidth, cursorY + row * 14);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), LETTERHEAD_MARGIN + col * colWidth + 100, cursorY + row * 14);
    doc.setFont('helvetica', 'normal');
  });
  cursorY += Math.ceil(summaryEntries.length / 2) * 14 + 10;

  autoTable(doc, {
    startY: cursorY,
    margin: { top: LETTERHEAD_HEIGHT + 14, left: LETTERHEAD_MARGIN, right: LETTERHEAD_MARGIN, bottom: 34 },
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key] ?? '')),
    styles: { fontSize: 8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    didDrawPage: () => {
      // Redraw the same letterhead on every page the table spans — never a
      // second, different header. Footers are finalized afterward once the
      // total page count is known.
      drawLetterhead(doc, {
        reportTitle: reportLabel,
        subtitle: `Generated ${new Date().toLocaleString()}  ·  Range ${rangeLabel}`,
      });
    },
  });

  finalizeFooters(doc);

  return doc.output('blob');
}

export function Reports() {
  const { settings } = useAppSettings();
  const role = useSelector((s) => s.auth.user?.role || 'User');
  const [reportType, setReportType] = useState('inventory');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [medicines, setMedicines] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
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

  // Audit logs live behind an admin-only endpoint, so they're only fetched
  // (once) when an admin actually picks the Audit report type — not eagerly
  // for everyone on page load.
  useEffect(() => {
    if (reportType !== 'audit' || role !== 'Admin' || auditLoaded) return;

    const loadAuditLogs = async () => {
      try {
        const { data } = await apiClient.get('/admin/logs', { params: { limit: 200 } });
        setAuditLogs(data?.data || []);
        setAuditLoaded(true);
      } catch (err) {
        console.error('Failed to load audit logs for report generation', err);
        setError('Unable to load audit logs for report generation.');
      }
    };

    loadAuditLogs();
  }, [reportType, role, auditLoaded]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Reset the previous PDF preview whenever the report type changes so the
  // person doesn't accidentally download a stale report under a new label.
  useEffect(() => {
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    setMessage('');
  }, [reportType]);

  const filteredMedicines = useMemo(
    () => (dateRange.start || dateRange.end ? medicines.filter((m) => isWithinDateRange(m.expiry_date, dateRange)) : medicines),
    [medicines, dateRange]
  );

  const filteredAuditLogs = useMemo(
    () => (dateRange.start || dateRange.end ? auditLogs.filter((l) => isWithinDateRange(l.timestamp || l.createdAt, dateRange)) : auditLogs),
    [auditLogs, dateRange]
  );

  const reportRows = useMemo(() => {
    if (reportType === 'suppliers') return buildSupplierRows(filteredMedicines);
    if (reportType === 'audit') return buildAuditRows(filteredAuditLogs);
    return buildInventoryRows(filteredMedicines);
  }, [reportType, filteredMedicines, filteredAuditLogs]);

  const summary = useMemo(() => {
    if (reportType === 'suppliers') return summarizeSuppliers(reportRows, filteredMedicines.length);
    if (reportType === 'audit') return summarizeAudit(filteredAuditLogs);
    return summarizeInventory(filteredMedicines, { expiryAlertDays: settings.expiryAlertDays, lowStockThreshold: settings.lowStockThreshold });
  }, [reportType, reportRows, filteredMedicines, filteredAuditLogs, settings.expiryAlertDays, settings.lowStockThreshold]);

  const columns = REPORT_TYPES[reportType].columns;
  const previewRows = useMemo(() => reportRows.slice(0, 10), [reportRows]);

  const kpiCards = useMemo(() => {
    if (reportType === 'suppliers') {
      return [
        { label: 'Suppliers', value: summary.totalSuppliers, icon: Box, color: '#059669', iconTone: 'bg-primary/10 text-primary' },
        { label: 'Medicines covered', value: summary.medicinesCovered, icon: BarChart3, color: '#059669', iconTone: 'bg-primary/10 text-primary' },
        { label: 'Avg items / supplier', value: summary.avgMedicinesPerSupplier, icon: Filter, color: '#F59E0B', iconTone: 'bg-amber-100 text-amber-700' },
        { label: 'Est. stock value (Rs.)', value: summary.estStockValue.toLocaleString(), icon: TrendingUp, color: '#0EA5E9', iconTone: 'bg-sky-100 text-sky-700' },
      ];
    }
    if (reportType === 'audit') {
      return [
        { label: 'Total log entries', value: summary.totalLogs, icon: ShieldCheck, color: '#059669', iconTone: 'bg-primary/10 text-primary' },
        { label: 'Unique users', value: summary.uniqueUsers, icon: Activity, color: '#0EA5E9', iconTone: 'bg-sky-100 text-sky-700' },
        { label: 'Top action', value: summary.topAction, icon: AlertTriangle, color: '#F59E0B', iconTone: 'bg-amber-100 text-amber-700' },
        { label: 'Admin actions', value: summary.adminActions, icon: Clock3, color: '#F43F5E', iconTone: 'bg-rose-100 text-rose-700' },
      ];
    }
    return [
      { label: 'Total medicines', value: summary.totalMedicines, icon: Database, color: '#059669', iconTone: 'bg-primary/10 text-primary' },
      { label: 'Total stock', value: summary.totalStock, icon: BarChart3, color: '#059669', iconTone: 'bg-primary/10 text-primary' },
      { label: 'Expiring soon', value: summary.expiringSoon, icon: Calendar, color: '#F59E0B', iconTone: 'bg-amber-100 text-amber-700' },
      { label: 'Out of stock', value: summary.outOfStock, icon: Filter, color: '#F43F5E', iconTone: 'bg-rose-100 text-rose-700' },
    ];
  }, [reportType, summary]);

  const isAuditBlocked = reportType === 'audit' && role !== 'Admin';

  const generateReport = async () => {
    if (isAuditBlocked) {
      setError('Audit reports require Admin access.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const blob = await buildPdfBlob(reportType, summary, columns, reportRows, dateRange);
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
      <PageHeader
        title="Working report viewer"
        description="Pick a report type below — Inventory, Suppliers, or Audit — and the summary, table, and PDF all rebuild to match it."
        image={PAGE_IMAGES.documentsDesk}
        imageAlt="Close-up of medicine pills and tablets"
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generateReport}
              disabled={loading || reportRows.length === 0 || isAuditBlocked}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <BarChart3 className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate report'}
            </button>
            <button
              onClick={downloadPdf}
              disabled={!pdfUrl}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        }
      />

      {/* Filter bar — one connected panel with divided columns instead of
          four separate boxes. */}
      <Reveal as="section" className="panel grid divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
        <div className="p-5">
          <p className="eyebrow-tag">Report type</p>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
            style={{ colorScheme: 'light' }}
          >
            <option value="inventory">Inventory</option>
            <option value="suppliers">Suppliers</option>
            {role === 'Admin' && <option value="audit">Audit</option>}
          </select>
        </div>

        <div className="p-5">
          <p className="eyebrow-tag">Start date</p>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((current) => ({ ...current, start: e.target.value }))}
            className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
          />
        </div>

        <div className="p-5">
          <p className="eyebrow-tag">End date</p>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((current) => ({ ...current, end: e.target.value }))}
            className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
          />
        </div>

        <div className="p-5">
          <p className="eyebrow-tag">Source rows</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{reportRows.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reportType === 'audit' ? 'Log entries available for this report' : reportType === 'suppliers' ? 'Suppliers available for this report' : 'Records available for this report'}
          </p>
        </div>
      </Reveal>

      {isAuditBlocked && <Alert type="danger">Audit reports require Admin access. Choose Inventory or Suppliers instead.</Alert>}
      {error && <Alert type="danger">{error}</Alert>}
      {message && <Alert type="success">{message}</Alert>}

      {/* Summary strip — same icon-left stat-tile KPI cards used on
          Dashboard/Inventory/Predictions/Purchases, for design uniformity.
          The cards themselves change with the selected report type. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item, index) => (
          <Reveal key={item.label} delay={index * 60}>
            <div className="stat-tile" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: item.color }}>
              <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconTone}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-semibold leading-none text-foreground">{item.value}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      <Reveal as="section" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-6">
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

          <div className="mt-6 overflow-hidden rounded-3xl border border-border/70 bg-white">
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
          <div className="panel-accent p-6" data-accent="teal">
            <div className="flex items-center gap-3 text-foreground">
              <Filter className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Report details</h2>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="row-divider py-2 first:border-t-0 first:pt-0">Type: <span className="font-medium text-foreground">{REPORT_TYPES[reportType].label}</span></p>
              <p className="row-divider py-2">Rows available: <span className="font-medium text-foreground">{reportRows.length}</span></p>
              {Object.entries(summary)
                .filter(([key]) => key !== 'title')
                .map(([key, value]) => (
                  <p key={key} className="row-divider py-2">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:{' '}
                    <span className="font-medium text-foreground">{value}</span>
                  </p>
                ))}
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="text-xl font-semibold text-foreground">Preview data</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-muted-foreground">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className="px-4 py-3">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                        No rows available for this report yet.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, index) => (
                      <tr key={index} className="border-b border-border/60 transition-colors hover:bg-primary/5">
                        {columns.map((column) => (
                          <td key={column.key} className="px-4 py-3 text-muted-foreground">{row[column.key] ?? '—'}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default Reports;
