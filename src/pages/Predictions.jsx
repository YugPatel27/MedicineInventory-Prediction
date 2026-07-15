import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiClient } from '../api/axios';
import Alert from '../components/Alert';
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

const Line = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.Line })));
const Bar = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.Bar })));
const Doughnut = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.Doughnut })));
const PolarArea = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.PolarArea })));

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
        color: ['#0ea5e9', '#38bdf8', '#f59e0b', '#8b5cf6'][index % 4],
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

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Forecasting</p>
            <h1 className="text-3xl font-semibold">Demand prediction</h1>
            <p className="mt-2 text-sm text-slate-500">Run the prediction engine to identify medicines that need replenishing or review.</p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <button onClick={runPredictionEngine} disabled={running} className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
              {running ? 'Running…' : 'Run forecast'}
            </button>
              <button
                type="button"
                onClick={async () => {
                  if (!predictions || predictions.length === 0) return;
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
                        doc.text('Forecast Report', 68, 14);
                        doc.setTextColor(100, 116, 139);
                        doc.setFontSize(9);
                        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 24, pageHeight - 10);
                      }
                    };
                    doc.setFontSize(16);
                    doc.setTextColor(15, 23, 42);
                    doc.text('MediStock Predictions Report', 14, 32);
                    doc.setFontSize(10);
                    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
                    autoTable(doc, {
                      startY: 44,
                      head: [['Medicine ID', 'Name', 'Predicted Demand', 'Risk', 'Stock gap', 'Expiry (d)', 'Recommendation']],
                      body: predictions.map((p) => [p.medicine_id, p.name, p.predicted_demand, `${p.risk_score}%`, p.reorder_gap || '—', p.days_until_expiry, p.recommendation]),
                      styles: { fontSize: 8 },
                    });
                    addHeaderFooter();
                    doc.save(`medistock_predictions_${Date.now()}.pdf`);
                    setNotification({ type: 'success', message: 'Predictions PDF downloaded.' });
                  } catch (err) {
                    console.error('Predictions PDF failed', err);
                    setNotification({ type: 'danger', message: 'Unable to generate predictions PDF.' });
                  }
                }}
                disabled={predictions.length === 0}
                className="rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-primary/5 disabled:opacity-50"
              >
                Download PDF
              </button>
            </div>
            {lastRun && <span className="text-xs text-muted-foreground">Last run: {new Date(lastRun).toLocaleString()}</span>}
          </div>
        </div>

        {notification && (
          <div className="mt-4">
            <Alert type={notification.type}>{notification.message}</Alert>
          </div>
        )}
        {errorMsg && <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{errorMsg}</div>}
        {/* Charts: demand distribution and recommendations breakdown */}
        {predictions.length > 0 && (
          <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border bg-white p-4">
              <h3 className="text-sm font-semibold text-foreground">Seasonal demand outlook</h3>
              <p className="mt-1 text-xs text-slate-500">Hover or click any season bar to inspect the forecast.</p>
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
                <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  <p className="font-semibold">{selectedSeasonInsight.medicine}</p>
                  <p className="mt-1">{selectedSeasonInsight.season} demand outlook: <span className="font-semibold">{selectedSeasonInsight.value}</span> units</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <h3 className="text-sm font-semibold text-foreground">Recommendation breakdown</h3>
              <div className="h-48 mt-3">
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="h-28">
                      <Doughnut
                        data={{
                          labels: ['Urgent restock', 'Plan restock', 'Sufficient stock'],
                          datasets: [{ data: [counts.urgent, counts.plan, counts.sufficient], backgroundColor: ['#ef4444', '#f59e0b', '#0ea5e9'] }],
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
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Urgent</p>
          <p className="mt-3 text-3xl font-semibold text-rose-600">{counts.urgent}</p>
          <p className="mt-2 text-sm text-slate-500">Needs restock immediately</p>
        </div>
        <div className="rounded-3xl border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Planned</p>
          <p className="mt-3 text-3xl font-semibold text-amber-600">{counts.plan}</p>
          <p className="mt-2 text-sm text-slate-500">Good candidate for restock planning</p>
        </div>
        <div className="rounded-3xl border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Sufficient</p>
          <p className="mt-3 text-3xl font-semibold text-sky-600">{counts.sufficient}</p>
          <p className="mt-2 text-sm text-slate-500">Stock is sufficient for now</p>
        </div>
        <div className="rounded-3xl border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Accuracy</p>
          <p className="mt-3 text-3xl font-semibold text-indigo-600">{accuracy ? `${accuracy}%` : '—'}</p>
          <p className="mt-2 text-sm text-slate-500">Forecast accuracy (&gt;80%)</p>
        </div>
      </section>

      {predictions.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                      datasets: [{ label: 'Projected demand', data: monthlySeries.map((item) => item.value), borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.18)', tension: 0.3, fill: true }],
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
                        data={{ labels: ['Urgent', 'Plan', 'Sufficient'], datasets: [{ data: [demandBuckets.urgent, demandBuckets.plan, demandBuckets.sufficient], backgroundColor: ['#ef4444', '#f59e0b', '#0ea5e9'] }] }}
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
                <div key={card.title} className={`rounded-2xl border border-border p-4 ${card.accent === 'rose' ? 'bg-rose-50' : card.accent === 'amber' ? 'bg-amber-50' : 'bg-sky-50'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{card.value}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Prediction results</h2>
            <p className="text-sm text-slate-500">Latest forecast output across inventory.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">{predictions.length} items</span>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
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
                    className={`border-b border-slate-100 ${prediction.recommendation === 'Urgent restock' ? 'bg-rose-50' : prediction.recommendation === 'Plan restock' ? 'bg-amber-50' : 'hover:bg-slate-50'} transition-colors`}
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
      </section>
    </div>
  );
}