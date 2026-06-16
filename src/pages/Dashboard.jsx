import { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { apiClient } from '../api/axios';
import { SEO } from '../components/SEO';
import { ArrowRight, ShieldCheck, TrendingUp, Clock3, Database } from '../components/Icons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Title, Tooltip, Legend);

export function Dashboard() {
  const [summary, setSummary] = useState({
    totalMedicines: 0,
    expiringSoon: 0,
    lowStock: 0,
    outOfStock: 0,
    highRisk: 0,
    reorderGapCount: 0,
    reorderGapTotal: 0,
  });
  const [topMedicines, setTopMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);
  const [forecasting, setForecasting] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [summaryResponse, medicinesResponse] = await Promise.all([
        apiClient.get('/medicines/summary'),
        apiClient.get('/medicines'),
      ]);

      setSummary(summaryResponse.data?.data?.summary || summary);
      setTopMedicines((medicinesResponse.data?.data || []).slice(0, 8));
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const runForecast = async () => {
    setForecasting(true);
    try {
      const { data } = await apiClient.post('/predictions/run');
      const results = data.data || [];
      setPredictions(results);
      await fetchDashboardData();
    } catch (err) {
      console.error('Forecast run failed', err);
    } finally {
      setForecasting(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: 'Total medicines', value: summary.totalMedicines, icon: Database, tone: 'bg-primary/10 text-primary' },
      { label: 'Expiring soon', value: summary.expiringSoon, icon: Clock3, tone: 'bg-sky-100 text-sky-700' },
      { label: 'Reorder gap', value: summary.reorderGapCount, icon: TrendingUp, tone: 'bg-slate-100 text-slate-700' },
      { label: 'Out of stock', value: summary.outOfStock, icon: ShieldCheck, tone: 'bg-sky-100 text-sky-700' },
    ],
    [summary]
  );

  const lineChartData = useMemo(() => {
    const forecastItems = predictions.length > 0 ? predictions.slice(0, 4) : [];
    return {
      labels: forecastItems.length > 0 ? forecastItems.map((item) => item.name || item.medicine_id) : ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Demand forecast',
          data: forecastItems.length > 0 ? forecastItems.map((item) => item.predicted_demand || 0) : [18, 22, 19, 24],
          borderColor: '#0EA5E9',
          backgroundColor: 'rgba(14, 165, 233, 0.18)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [predictions]);

  const expiryBlockCount = useMemo(
    () => predictions.filter((item) => Number(item.days_until_expiry) > -1 && Number(item.days_until_expiry) <= 30).length,
    [predictions]
  );

  const accuracyChartData = useMemo(
    () => ({
      labels: ['Accuracy', 'Error'],
      datasets: [
        {
          label: 'Prediction precision',
          data: [85, 15],
          backgroundColor: ['#3B82F6', '#60A5FA'],
          borderRadius: 12,
        },
      ],
    }),
    []
  );

  const barChartData = useMemo(
    () => ({
      labels: topMedicines.map((medicine) => medicine.medicine_name || medicine.medicine_id || 'N/A'),
      datasets: [
        {
          label: 'Stock quantity',
          data: topMedicines.map((medicine) => medicine.stock_quantity || 0),
          backgroundColor: '#38BDF8',
          borderRadius: 12,
        },
      ],
    }),
    [topMedicines]
  );

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-[2rem] border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SEO title="Dashboard — MediStock" description="Review medicine inventory health, expiry risk, and demand forecast insights in MediStock." url="/dashboard" />

      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">Inventory prediction intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Keep medicine stock levels optimal, reduce expiry waste, and use local forecasting to support reorder decisions. MediStock helps pharmacy teams manage rack and shelf layout, batch expiry, procurement compliance, and billing in one flow.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Local prediction engine</p>
            <p className="mt-2">No paid APIs. No vendor lock-in. Predict demand from your own inventory data.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Rack & shelf control</h3>
          <p className="mt-3 text-sm text-slate-600">Map medicines to racks and shelves so your pharmacy can move stock quickly during peak demand.</p>
          <p className="mt-4 text-sm font-semibold text-foreground">{summary.totalMedicines} medicines are tracked for shelf-ready placement.</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Compliance ready</h3>
          <p className="mt-3 text-sm text-slate-600">Keep audit trails, drug compliance reports, and statutory records organized for pharmacy regulators.</p>
          <p className="mt-4 text-sm font-semibold text-foreground">{summary.expiringSoon} expiry alerts and {summary.highRisk} high-risk items today.</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Procurement excellence</h3>
          <p className="mt-3 text-sm text-slate-600">Manage inward purchases, vendor orders, and reorder gaps with better procurement visibility.</p>
          <p className="mt-4 text-sm font-semibold text-foreground">{summary.reorderGapCount} reorder gaps totaling {summary.reorderGapTotal} units.</p>
        </div>
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Expiry blocking</h3>
          <p className="mt-3 text-sm text-slate-600">Automatically flag and block short-expiry drugs at inward receipt and sale to protect margins and compliance.</p>
          <p className="mt-4 text-sm font-semibold text-foreground">{expiryBlockCount} medicines flagged for short-expiry control.</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Forecasting</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Run prediction</h2>
          </div>
          <div className="flex gap-3">
            <button onClick={runForecast} disabled={forecasting} className="btn-theme inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              {forecasting ? 'Running…' : 'Run forecast'}
            </button>
          </div>
        </div>

        {predictions.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-4">
              <h3 className="font-semibold">Risk scores</h3>
              <div className="mt-3 h-44">
                <Bar
                  data={{
                    labels: predictions.map((p) => p.name || p.medicine_id),
                    datasets: [
                      {
                        label: 'Risk score',
                        data: predictions.map((p) => p.risk_score),
                        backgroundColor: 'rgba(59,130,246,0.8)',
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <h3 className="font-semibold">Recommendations</h3>
              <div className="mt-3 h-44">
                <Doughnut
                  data={{
                    labels: Array.from(new Set(predictions.map((p) => p.recommendation))),
                    datasets: [
                      {
                        data: Array.from(new Set(predictions.map((p) => p.recommendation))).map((r) => predictions.filter((p) => p.recommendation === r).length),
                        backgroundColor: ['#3B82F6', '#F59E0B', '#EF4444'],
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Forecast</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Demand trend</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">Logistic Regression</span>
          </div>
          <div className="mt-6 h-[320px]">
            <Line data={lineChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Stock snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Top medicines</h2>
            </div>
            <span className="rounded-full bg-secondary/10 px-3 py-2 text-xs font-semibold text-secondary">Live stock</span>
          </div>
          <div className="mt-6 h-[320px]">
            <Bar data={barChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Workflow</p>
          <h2 className="mt-4 text-xl font-semibold text-foreground">From data to recommendation</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <ArrowRight className="mt-1 h-4 w-4 text-primary" />
              Historical inventory and expiry data are cleaned and scored.
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="mt-1 h-4 w-4 text-primary" />
              Logistic regression predicts demand risk for each medicine.
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="mt-1 h-4 w-4 text-primary" />
              End-to-end procurement management keeps orders aligned with shelf capacity.
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="mt-1 h-4 w-4 text-primary" />
              Block short-expiry batches during inward receipt and sales to avoid write-offs.
            </li>
            <li className="flex items-start gap-3">
              <ArrowRight className="mt-1 h-4 w-4 text-primary" />
              Track margins, aging, non-moving stock, and batch movement across your pharmacy.
            </li>
          </ul>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Health</p>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Inventory risk</h2>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="font-semibold text-foreground">Expiry alerts</p>
              <p className="mt-2">{summary.expiringSoon} medicines will expire soon.</p>
            </div>
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="font-semibold text-foreground">High-risk stock</p>
              <p className="mt-2">{summary.highRisk} medicines need buying or review.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Insights</p>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Operational view</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            MediStock helps reduce shortages, overstock, and expiry waste by focusing on demand, stock, and supplier timing.
          </p>
        </div>
      </section>
    </div>
  );
}
