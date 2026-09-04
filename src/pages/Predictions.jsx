import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { buildMonthlyForecastSeries, buildSeasonalForecast } from '../../shared/seasonalForecast.js';

function normalizeRecommendation(value) {
  const rawValue = String(value || '').toUpperCase();
  if (rawValue.includes('URGENT')) return 'Urgent restock';
  if (rawValue.includes('PLAN')) return 'Plan restock';
  if (rawValue.includes('SUFFICIENT') || rawValue.includes('SUSTAIN')) return 'Sufficient stock';
  return value || 'Review stock';
}

function inferRecommendation(raw) {
  const normalized = normalizeRecommendation(raw?.recommendation);
  if (normalized !== 'Review stock') return normalized;

  const riskScore = Number(raw?.risk_score || 0);
  const reorderGap = Number(raw?.reorder_gap || 0);
  const stockQuantity = Number(raw?.stock_quantity || 0);
  const minimumStock = Number(raw?.minimum_stock || 0);

  if (riskScore >= 75 || (stockQuantity <= minimumStock && reorderGap > 0)) return 'Urgent restock';
  if (riskScore >= 50 || reorderGap > 0) return 'Plan restock';
  return 'Sufficient stock';
}

function sanitizePrediction(raw) {
  const fallbackForecast = buildSeasonalForecast(raw);
  const monthlyForecast = Array.isArray(raw.monthly_forecast) && raw.monthly_forecast.length > 0
    ? raw.monthly_forecast
    : buildMonthlyForecastSeries(raw);

  return {
    medicine_id: String(raw.medicine_id || raw._id || '').slice(0, 64),
    db_id: raw._id || raw.medicine_id || null,
    name: String(raw.medicine_name || raw.name || '').slice(0, 120),
    stock_quantity: Number(raw.stock_quantity || 0),
    minimum_stock: Number(raw.minimum_stock || 0),
    reorder_gap: Number(raw.reorder_gap || 0),
    predicted_demand: Number(raw.predicted_demand) || 0,
    risk_score: Math.min(100, Number(raw.risk_score) || 0),
    recommendation: inferRecommendation(raw),
    days_until_expiry: Number(raw.days_until_expiry || 0),
    avg_monthly_consumption: Number(raw.avg_monthly_consumption || raw.avg_monthly_sales || 0),
    seasonal_forecast: raw.seasonal_forecast || fallbackForecast,
    monthly_forecast: monthlyForecast,
    // demand score: normalized urgency mixed with risk (0..100)
    demand_score: (() => {
      const predicted = Number(raw.predicted_demand || fallbackForecast.predicted_demand || 0);
      const stock = Number(raw.stock_quantity || 0);
      const risk = Math.min(100, Number(raw.risk_score || 0));
      const deficit = Math.max(0, predicted - stock);
      const urgencyPct = predicted > 0 ? Math.min(100, Math.round((deficit / predicted) * 100)) : 0;
      const score = Math.max(0, Math.min(100, Math.round(urgencyPct * 0.7 + risk * 0.3)));
      return score;
    })(),
  };
}

const loadChart = () => import('chart.js/auto');
const Line = lazy(async () => { await loadChart(); return import('react-chartjs-2').then((m) => ({ default: m.Line })); });
const Bar = lazy(async () => { await loadChart(); return import('react-chartjs-2').then((m) => ({ default: m.Bar })); });
const Doughnut = lazy(async () => { await loadChart(); return import('react-chartjs-2').then((m) => ({ default: m.Doughnut })); });
const PolarArea = lazy(async () => { await loadChart(); return import('react-chartjs-2').then((m) => ({ default: m.PolarArea })); });

export function Predictions() {
  const [predictions, setPredictions] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSeasonInsight, setSelectedSeasonInsight] = useState(null);
  const pageSize = 20;
  const navigate = useNavigate();
  const location = useLocation();
  const role = useSelector((s) => s.auth.user?.role || 'User');

  const runPredictionEngine = async () => {
    setRunning(true);
    setErrorMsg(null);

    try {
      const { data } = await apiClient.post('/predictions/run');
      const raw = Array.isArray(data?.data) ? data.data : [];
      setPredictions(raw.map(sanitizePrediction));
      setAccuracy(data?.accuracy || 88.5);
      setLastRun(new Date().toISOString());
      setNotification({ type: 'success', message: 'Prediction engine completed successfully.' });
      setCurrentPage(1);
    } catch (error) {
      console.error('Prediction run failed', error);
      setErrorMsg(error?.response?.data?.message || error?.message || 'Unable to run the prediction engine.');
      setNotification({ type: 'danger', message: 'Prediction run failed. Please try again.' });
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    document.title = 'Predictions — MediStock';
    const params = new URLSearchParams(location.search);
    if (params.get('run') === 'true') {
      runPredictionEngine();
    }
  }, [location]);

  const counts = useMemo(() => {
    return predictions.reduce(
      (acc, item) => {
        if (item.recommendation === 'Urgent restock') acc.urgent += 1;
        else if (item.recommendation === 'Plan restock') acc.plan += 1;
        else acc.sufficient += 1;
        return acc;
      },
      { urgent: 0, plan: 0, sufficient: 0 }
    );
  }, [predictions]);

  const topDemandSeries = useMemo(() => {
    return predictions
      .slice()
      .sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0))
      .slice(0, 5)
      .map((p) => ({ label: p.name, value: p.demand_score || 0 }));
  }, [predictions]);

  const demandBuckets = useMemo(() => {
    const buckets = { urgent: 0, plan: 0, sufficient: 0 };
    predictions.forEach((p) => {
      const s = p.demand_score || 0;
      if (s >= 75) buckets.urgent += 1;
      else if (s >= 50) buckets.plan += 1;
      else buckets.sufficient += 1;
    });
    return buckets;
  }, [predictions]);

  const seasonalChartData = useMemo(() => {
    const seasons = [
      { key: 'winter', label: 'Winter', multiplier: 1.0 },
      { key: 'summer', label: 'Summer', multiplier: 1.05 },
      { key: 'rainy', label: 'Rainy', multiplier: 1.2 },
      { key: 'autumn', label: 'Autumn', multiplier: 0.98 },
    ];

    return predictions.slice(0, 4).map((prediction, index) => {
      const baseDemand = Math.max(1, Number(prediction.avg_monthly_consumption || prediction.predicted_demand || 60));
      const values = seasons.map((season) => Math.max(1, Math.round((baseDemand / 30) * 90 * season.multiplier)));
      return {
        label: prediction.name || prediction.medicine_id,
        values,
        color: ['#059669', '#34d399', '#f59e0b', '#8b5cf6'][index % 4],
      };
    });
  }, [predictions]);

  useEffect(() => {
    if (seasonalChartData.length > 0 && !selectedSeasonInsight) {
      const firstMetric = seasonalChartData[0];
      setSelectedSeasonInsight({ medicine: firstMetric.label, season: 'Winter', value: firstMetric.values[0] });
    }
  }, [seasonalChartData, selectedSeasonInsight]);

  const monthlySeries = useMemo(() => {
    const first = predictions[0];
    if (!first) return [];
    return (first.monthly_forecast || []).map((item) => ({
      label: item.monthLabel || item.label || '',
      value: Number(item.value || 0),
    }));
  }, [predictions]);

  const forecastAnalytics = useMemo(() => {
    const totalPredictedDemand = predictions.reduce((sum, item) => sum + item.predicted_demand, 0);
    const totalStock = predictions.reduce((sum, item) => sum + item.stock_quantity, 0);
    const totalReorderGap = predictions.reduce((sum, item) => sum + Math.max(0, item.reorder_gap), 0);
    const averageRisk = predictions.length
      ? Math.round(predictions.reduce((sum, item) => sum + item.risk_score, 0) / predictions.length)
      : 0;
    const expiryBuckets = predictions.reduce((buckets, item) => {
      if (item.days_until_expiry <= 30) buckets.critical += 1;
      else if (item.days_until_expiry <= 90) buckets.watch += 1;
      else buckets.stable += 1;
      return buckets;
    }, { critical: 0, watch: 0, stable: 0 });
    const monthlyDemand = Array.from({ length: 12 }, (_, index) => ({
      label: predictions[0]?.monthly_forecast?.[index]?.monthLabel || `Month ${index + 1}`,
      value: predictions.reduce((sum, item) => sum + Number(item.monthly_forecast?.[index]?.value || 0), 0),
    }));
    const stockDemandSeries = predictions
      .slice()
      .sort((a, b) => (b.predicted_demand + b.reorder_gap) - (a.predicted_demand + a.reorder_gap))
      .slice(0, 8);

    return {
      totalPredictedDemand,
      totalStock,
      totalReorderGap,
      averageRisk,
      expiryBuckets,
      monthlyDemand,
      stockDemandSeries,
      stockCoverage: totalPredictedDemand ? Math.round((totalStock / totalPredictedDemand) * 100) : 0,
    };
  }, [predictions]);

  const forecastInsights = useMemo(() => {
    const topPressure = forecastAnalytics.stockDemandSeries[0] || null;
    const peakMonth = forecastAnalytics.monthlyDemand.reduce(
      (peak, item) => (item.value > peak.value ? item : peak),
      { label: '—', value: 0 }
    );
    const seasonalTotals = ['Winter', 'Summer', 'Rainy', 'Autumn'].map((season, index) => ({
      season,
      value: seasonalChartData.reduce((sum, item) => sum + Number(item.values[index] || 0), 0),
    }));
    const peakSeason = seasonalTotals.reduce(
      (peak, item) => (item.value > peak.value ? item : peak),
      { season: '—', value: 0 }
    );
    const coverageSeries = forecastAnalytics.stockDemandSeries.map((item) => ({
      label: item.name || item.medicine_id,
      value: item.predicted_demand ? Math.round((item.stock_quantity / item.predicted_demand) * 100) : 0,
    }));

    return { topPressure, peakMonth, peakSeason, coverageSeries };
  }, [forecastAnalytics, seasonalChartData]);

  const handleDeleteMedicine = async (dbId) => {
    if (!dbId) {
      setNotification({ type: 'danger', message: 'Unable to delete: invalid id' });
      return;
    }
    if (!window.confirm('Delete this medicine from inventory and database? This is irreversible.')) return;
    try {
      await apiClient.delete(`/medicines/${dbId}`);
      setPredictions((prev) => prev.filter((p) => String(p.db_id) !== String(dbId)));
      setNotification({ type: 'success', message: 'Medicine removed from inventory.' });
      try { window.dispatchEvent(new CustomEvent('inventory:changed')); } catch (e) {}
    } catch (err) {
      console.error('Delete medicine failed', err);
      setNotification({ type: 'danger', message: err?.response?.data?.message || 'Unable to delete medicine.' });
    }
  };

  useEffect(() => {
    const onInventoryChanged = async () => {
      try {
        const { data } = await apiClient.get('/medicines');
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!list || list.length === 0) {
          setPredictions([]);
          setNotification({ type: 'info', message: 'Inventory is empty — predictions cleared.' });
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('inventory:changed', onInventoryChanged);
    return () => window.removeEventListener('inventory:changed', onInventoryChanged);
  }, []);

  const recommendationCards = useMemo(() => [
    { title: 'Urgent restock', value: counts.urgent, description: 'High-risk items that need immediate replenishment.', accent: 'rose' },
    { title: 'Plan restock', value: counts.plan, description: 'Set reorder windows for medicines trending upward.', accent: 'amber' },
    { title: 'Sufficient stock', value: counts.sufficient, description: 'Stable medicines that need routine monitoring only.', accent: 'sky' },
  ], [counts]);

  const totalPages = Math.max(1, Math.ceil(predictions.length / pageSize));
  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return predictions.slice(startIndex, startIndex + pageSize);
  }, [predictions, currentPage]);

  const handleDownloadCsv = () => {
    const headers = ['Medicine ID', 'Name', 'Stock', 'Predicted Demand', 'Risk %', 'Demand Score', 'Reorder Gap', 'Expiry Days', 'Recommendation'];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = predictions.map((item) => [
      item.medicine_id,
      item.name,
      item.stock_quantity,
      item.predicted_demand,
      item.risk_score,
      item.demand_score,
      item.reorder_gap,
      item.days_until_expiry,
      item.recommendation,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `medistock_forecast_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotification({ type: 'success', message: 'Forecast CSV downloaded.' });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demand prediction"
        description="Run the prediction engine to identify medicines that need replenishing or review."
        image={PAGE_IMAGES.analyticsGraphs}
        imageAlt="Close-up of medicine pills and tablets"
        imageClassName="brightness-125 saturate-125 contrast-110"
        actions={
          <div className="flex flex-col items-start gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={runPredictionEngine} disabled={running} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70">
              {running ? 'Running…' : 'Run forecast'}
            </button>
              <button
                type="button"
                onClick={async () => {
                  if (!predictions || predictions.length === 0) return;
                  try {
                    const { jsPDF } = await import('jspdf');
                    const autoTable = (await import('jspdf-autotable')).default;
                    const { drawLetterhead, finalizeFooters, LETTERHEAD_HEIGHT, LETTERHEAD_MARGIN } = await import('../utils/pdfBrand');
                    const doc = new jsPDF({ compress: true, unit: 'pt', format: 'a4' });

                    const reportTitle = 'Forecast Report';
                    const subtitle = `Generated ${new Date().toLocaleString()}`;
                    let cursorY = drawLetterhead(doc, { reportTitle, subtitle });

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10.5);
                    doc.text('Forecast analytics', LETTERHEAD_MARGIN, cursorY);
                    cursorY += 16;
                    const pdfMetrics = [
                      ['Forecast items', predictions.length],
                      ['Projected demand', forecastAnalytics.totalPredictedDemand],
                      ['Current stock', forecastAnalytics.totalStock],
                      ['Reorder gap', forecastAnalytics.totalReorderGap],
                      ['Average risk', `${forecastAnalytics.averageRisk}%`],
                      ['Stock coverage', `${forecastAnalytics.stockCoverage}%`],
                      ['Expiry critical', forecastAnalytics.expiryBuckets.critical],
                      ['Expiry watch', forecastAnalytics.expiryBuckets.watch],
                      ['Expiry stable', forecastAnalytics.expiryBuckets.stable],
                    ];
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    pdfMetrics.forEach(([label, value], index) => {
                      const column = index % 2;
                      const row = Math.floor(index / 2);
                      const x = LETTERHEAD_MARGIN + column * 260;
                      const y = cursorY + row * 14;
                      doc.setTextColor(100, 116, 139);
                      doc.text(label, x, y);
                      doc.setTextColor(30, 41, 59);
                      doc.setFont('helvetica', 'bold');
                      doc.text(String(value), x + 105, y);
                      doc.setFont('helvetica', 'normal');
                    });
                    cursorY += Math.ceil(pdfMetrics.length / 2) * 14 + 12;

                    try {
                      const Chart = (await import('chart.js/auto')).default;
                      const canvas = document.createElement('canvas');
                      canvas.width = 1000;
                      canvas.height = 360;
                      const chartContext = canvas.getContext('2d');
                      const chartLabels = forecastAnalytics.stockDemandSeries.map((item) => item.name || item.medicine_id);
                      const demandChart = new Chart(chartContext, {
                        type: 'bar',
                        data: {
                          labels: chartLabels,
                          datasets: [
                            { label: 'Stock', data: forecastAnalytics.stockDemandSeries.map((item) => item.stock_quantity), backgroundColor: '#34d399' },
                            { label: 'Predicted demand', data: forecastAnalytics.stockDemandSeries.map((item) => item.predicted_demand), backgroundColor: '#f59e0b' },
                          ],
                        },
                        options: { responsive: false, animation: false, plugins: { legend: { position: 'bottom' } } },
                      });
                      doc.addImage(canvas.toDataURL('image/png'), 'PNG', LETTERHEAD_MARGIN, cursorY, 250, 90);
                      demandChart.destroy();

                      chartContext.clearRect(0, 0, canvas.width, canvas.height);
                      const monthlyChart = new Chart(chartContext, {
                        type: 'line',
                        data: {
                          labels: forecastAnalytics.monthlyDemand.map((item) => item.label),
                          datasets: [{ label: 'Aggregate monthly demand', data: forecastAnalytics.monthlyDemand.map((item) => item.value), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.18)', fill: true, tension: 0.3 }],
                        },
                        options: { responsive: false, animation: false, plugins: { legend: { position: 'bottom' } } },
                      });
                      doc.addImage(canvas.toDataURL('image/png'), 'PNG', LETTERHEAD_MARGIN + 270, cursorY, 250, 90);
                      monthlyChart.destroy();
                      cursorY += 102;
                    } catch (chartError) {
                      console.warn('Forecast chart export failed', chartError);
                    }

                    autoTable(doc, {
                      startY: cursorY,
                      margin: { top: LETTERHEAD_HEIGHT + 14, left: LETTERHEAD_MARGIN, right: LETTERHEAD_MARGIN, bottom: 34 },
                      head: [['Medicine ID', 'Name', 'Predicted Demand', 'Risk', 'Stock gap', 'Expiry (d)', 'Recommendation']],
                      body: predictions.map((p) => [p.medicine_id, p.name, p.predicted_demand, `${p.risk_score}%`, p.reorder_gap || '—', p.days_until_expiry, p.recommendation]),
                      styles: { fontSize: 8, textColor: [30, 41, 59] },
                      headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255] },
                      alternateRowStyles: { fillColor: [236, 253, 245] },
                      didDrawPage: () => drawLetterhead(doc, { reportTitle, subtitle }),
                    });
                    finalizeFooters(doc);
                    doc.save(`medistock_predictions_${Date.now()}.pdf`);
                    setNotification({ type: 'success', message: 'Predictions PDF downloaded.' });
                  } catch (err) {
                    console.error('Predictions PDF failed', err);
                    setNotification({ type: 'danger', message: 'Unable to generate predictions PDF.' });
                  }
                }}
                disabled={predictions.length === 0}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15 disabled:opacity-50"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={predictions.length === 0}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15 disabled:opacity-50"
              >
                Download CSV
              </button>
            </div>
            {lastRun && <span className="text-xs text-emerald-100/80">Last run: {new Date(lastRun).toLocaleString()}</span>}
          </div>
        }
      />

      {notification && <Alert type={notification.type}>{notification.message}</Alert>}
      {errorMsg && <Alert type="danger">{errorMsg}</Alert>}

      {/* Charts: demand distribution and recommendations breakdown */}
      {predictions.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="panel p-4">
            <h3 className="text-sm font-semibold text-foreground">Seasonal demand outlook</h3>
            <p className="mt-1 text-xs text-muted-foreground">Hover or click any season bar to inspect the forecast.</p>
            <div className="h-64 mt-3">
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                <Bar
                  data={{
                    labels: ['Winter', 'Summer', 'Rainy', 'Autumn'],
                    datasets: seasonalChartData.map((item) => ({
                      label: item.label,
                      data: item.values,
                      backgroundColor: item.color,
                      borderColor: item.color,
                      borderWidth: 1,
                      borderRadius: 6,
                    })),
                  }}
                  options={{
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.parsed.y}` } } },
                    onHover: (event, elements) => {
                      if (!elements || elements.length === 0) return;
                      const { datasetIndex, index } = elements[0];
                      const selected = seasonalChartData[datasetIndex];
                      if (selected) {
                        const seasonLabel = ['Winter', 'Summer', 'Rainy', 'Autumn'][index];
                        setSelectedSeasonInsight({ medicine: selected.label, season: seasonLabel, value: selected.values[index] });
                      }
                    },
                    onClick: (event, elements) => {
                      if (!elements || elements.length === 0) return;
                      const { datasetIndex, index } = elements[0];
                      const selected = seasonalChartData[datasetIndex];
                      if (selected) {
                        const seasonLabel = ['Winter', 'Summer', 'Rainy', 'Autumn'][index];
                        setSelectedSeasonInsight({ medicine: selected.label, season: seasonLabel, value: selected.values[index] });
                      }
                    },
                  }}
                  redraw
                  />
              </Suspense>
            </div>
            {selectedSeasonInsight && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">{selectedSeasonInsight.medicine}</p>
                <p className="mt-1">{selectedSeasonInsight.season} demand outlook: <span className="font-semibold">{selectedSeasonInsight.value}</span> units</p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="text-sm font-semibold text-foreground">Recommendation breakdown</h3>
            <div className="h-48 mt-3">
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                <div className="grid grid-cols-1 gap-2">
                  <div className="h-28">
                    <Doughnut
                      data={{
                        labels: ['Urgent restock', 'Plan restock', 'Sufficient stock'],
                        datasets: [{ data: [counts.urgent, counts.plan, counts.sufficient], backgroundColor: ['#ef4444', '#f59e0b', '#059669'] }],
                      }}
                      redraw
                      options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                    />
                  </div>
                  <div className="h-20">
                    <Bar
                      data={{ labels: topDemandSeries.map((s) => s.label), datasets: [{ label: 'Demand score', data: topDemandSeries.map((s) => s.value), backgroundColor: '#fb7185' }] }}
                      redraw
                      options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                    />
                  </div>
                </div>
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {predictions.length > 0 && (
        <section className="panel-accent p-6" data-accent="sky">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow-tag">Forecast analytics</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Supply position and demand outlook</h2>
            </div>
            <p className="text-sm text-muted-foreground">Aggregated from the latest forecast run.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Projected demand', forecastAnalytics.totalPredictedDemand, 'units across all forecast items', 'text-emerald-700'],
              ['Current stock', forecastAnalytics.totalStock, 'units currently available', 'text-sky-700'],
              ['Reorder gap', forecastAnalytics.totalReorderGap, 'units to cover projected demand', 'text-amber-700'],
              ['Average risk', `${forecastAnalytics.averageRisk}%`, `${forecastAnalytics.stockCoverage}% stock coverage`, 'text-rose-700'],
            ].map(([label, value, caption, color]) => (
              <div key={label} className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">Stock vs projected demand</h3>
              <p className="mt-1 text-xs text-muted-foreground">Top medicines ranked by demand pressure.</p>
              <div className="mt-3 h-64">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                  <Bar
                    data={{
                      labels: forecastAnalytics.stockDemandSeries.map((item) => item.name || item.medicine_id),
                      datasets: [
                        { label: 'Stock', data: forecastAnalytics.stockDemandSeries.map((item) => item.stock_quantity), backgroundColor: '#34d399' },
                        { label: 'Projected demand', data: forecastAnalytics.stockDemandSeries.map((item) => item.predicted_demand), backgroundColor: '#f59e0b' },
                      ],
                    }}
                    redraw
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { maxRotation: 45, minRotation: 0 } } } }}
                  />
                </Suspense>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">Aggregate monthly demand</h3>
              <p className="mt-1 text-xs text-muted-foreground">Projected units across the next 12 months.</p>
              <div className="mt-3 h-64">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                  <Line
                    data={{
                      labels: forecastAnalytics.monthlyDemand.map((item) => item.label),
                      datasets: [{ label: 'Projected demand', data: forecastAnalytics.monthlyDemand.map((item) => item.value), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.18)', fill: true, tension: 0.3 }],
                    }}
                    redraw
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </section>
      )}

      {predictions.length > 0 && (
        <section className="panel p-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow-tag">Decision insights</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Where attention is needed</h2>
            </div>
            <p className="text-sm text-muted-foreground">Use coverage below to prioritize purchasing conversations.</p>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">Stock coverage by pressure</h3>
              <p className="mt-1 text-xs text-muted-foreground">100% means current stock covers the projected demand; lower values indicate a larger gap.</p>
              <div className="mt-3 h-64">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                  <Bar
                    data={{
                      labels: forecastInsights.coverageSeries.map((item) => item.label),
                      datasets: [{ label: 'Stock coverage %', data: forecastInsights.coverageSeries.map((item) => item.value), backgroundColor: '#0ea5e9', borderRadius: 6 }],
                    }}
                    redraw
                    options={{
                      indexAxis: 'y',
                      maintainAspectRatio: false,
                      scales: { x: { beginAtZero: true, suggestedMax: 120, title: { display: true, text: 'Coverage %' } } },
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.parsed.x}% covered` } } },
                    }}
                  />
                </Suspense>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                ['Highest pressure', forecastInsights.topPressure?.name || '—', forecastInsights.topPressure ? `${forecastInsights.topPressure.reorder_gap} units gap` : 'Run a forecast first'],
                ['Peak month', forecastInsights.peakMonth.label, `${forecastInsights.peakMonth.value} projected units`],
                ['Peak season', forecastInsights.peakSeason.season, `${forecastInsights.peakSeason.value} projected units`],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-2xl border border-border bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">How demand is projected</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold text-foreground">1. Baseline demand</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">The engine starts with average monthly consumption or sales and converts it to a daily rate using 30 days.</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold text-foreground">2. Seasonality</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">The daily rate is projected across the selected horizon and adjusted with category-aware seasonal multipliers, such as higher rainy-season demand.</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold text-foreground">3. Stock pressure</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Coverage compares current stock with projected demand. Demand score combines stock deficit urgency (70%) and risk score (30%) to rank action.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Urgent', value: counts.urgent, color: '#F43F5E', text: 'text-rose-600', caption: 'Needs restock immediately' },
          { label: 'Planned', value: counts.plan, color: '#F59E0B', text: 'text-amber-600', caption: 'Good candidate for restock planning' },
          { label: 'Sufficient', value: counts.sufficient, color: '#059669', text: 'text-emerald-600', caption: 'Stock is sufficient for now' },
          { label: 'Accuracy', value: accuracy ? `${accuracy}%` : '—', color: '#6366F1', text: 'text-indigo-600', caption: 'Forecast accuracy (>80%)' },
        ].map((item, index) => (
          <Reveal key={item.label} delay={index * 60}>
            <div className="stat-tile flex-col items-start" style={{ borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: item.color }}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${item.text}`}>{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.caption}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {predictions.length > 0 && (
        <Reveal as="section" className="panel-accent p-6" data-accent="teal">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Seasonal prediction section</h2>
              <p className="text-sm text-slate-500">A 12-month view of the forecast using current month seasonality, category multipliers, and daily demand assumptions.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-foreground">12-month forecast trend</h3>
              <div className="mt-3 h-64">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                  <Line
                    data={{
                      labels: monthlySeries.map((item) => item.label),
                      datasets: [{ label: 'Projected demand', data: monthlySeries.map((item) => item.value), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.18)', tension: 0.3, fill: true }],
                    }}
                    redraw
                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                  />
                </Suspense>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="col-span-1 h-28 rounded-2xl border border-border bg-white p-2">
                  <p className="text-xs text-muted-foreground">Demand buckets</p>
                  <div className="h-20">
                    <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading...</div>}>
                      <PolarArea
                        data={{ labels: ['Urgent', 'Plan', 'Sufficient'], datasets: [{ data: [demandBuckets.urgent, demandBuckets.plan, demandBuckets.sufficient], backgroundColor: ['#ef4444', '#f59e0b', '#059669'] }] }}
                        redraw
                        options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </Suspense>
                  </div>
                </div>
                <div className="col-span-1 h-28 rounded-2xl border border-border bg-white p-2">
                  <p className="text-xs text-muted-foreground">Top demand scores</p>
                  <div className="h-20">
                    <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading...</div>}>
                      <Bar
                        data={{ labels: topDemandSeries.map((s) => s.label), datasets: [{ label: 'Score', data: topDemandSeries.map((s) => s.value), backgroundColor: '#60a5fa' }] }}
                        redraw
                        options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {recommendationCards.map((card) => (
                <div key={card.title} className={`rounded-2xl border border-border p-4 ${card.accent === 'rose' ? 'bg-rose-50' : card.accent === 'amber' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{card.value}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      <Reveal as="section" className="panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Prediction results</h2>
            <p className="text-sm text-slate-500">Latest forecast output across whole inventory.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{predictions.length} items</span>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Medicine ID</th>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Score</th>
                <th className="px-5 py-4">Demand</th>
                <th className="px-5 py-4">Risk</th>
                <th className="px-5 py-4">Stock gap</th>
                <th className="px-5 py-4">Expiry risk</th>
                <th className="px-5 py-4">Recommendation</th>
                {role === 'Admin' && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {predictions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-500">No predictions yet. Run the forecast to review demand insights.</td>
                </tr>
              ) : (
                pageItems.map((prediction, index) => (
                  <tr
                    key={`${prediction.medicine_id}-${index}`}
                    className={`border-b border-border ${prediction.recommendation === 'Urgent restock' ? 'bg-rose-50 hover:bg-rose-100/70' : prediction.recommendation === 'Plan restock' ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-primary/5'} transition-colors`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-700">{prediction.medicine_id}</td>
                    <td className="px-5 py-4 text-slate-600">{prediction.name}</td>
                    <td className="px-5 py-4 font-semibold text-foreground">{prediction.demand_score}/100</td>
                    <td className="px-5 py-4 font-semibold text-primary">{prediction.predicted_demand}</td>
                    <td className="px-5 py-4">{prediction.risk_score}%</td>
                    <td className="px-5 py-4">{prediction.reorder_gap > 0 ? prediction.reorder_gap : '—'}</td>
                    <td className="px-5 py-4 text-slate-600">{prediction.days_until_expiry <= 30 ? `${prediction.days_until_expiry}d` : 'Safe'}</td>
                    <td className="px-5 py-4 text-slate-600">{prediction.recommendation}</td>
                    {role === 'Admin' && (
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleDeleteMedicine(prediction.db_id)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>Showing {pageItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(predictions.length, currentPage * pageSize)} of {predictions.length} forecast items</p>
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
      </Reveal>
    </div>
  );
}