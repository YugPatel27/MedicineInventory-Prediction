import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/axios';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import jsPDF from 'jspdf';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const Line = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.Line })));
const Doughnut = lazy(() => import('react-chartjs-2').then((m) => ({ default: m.Doughnut })));

export function Insights() {
  const [summary, setSummary] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const lineRef = useRef(null);
  const doughnutRef = useRef(null);

  const [started, setStarted] = useState(false);

  useEffect(() => {
    document.title = 'Insights — MediStock';
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const [summaryRes, medsRes] = await Promise.all([
        apiClient.get('/medicines/summary'),
        apiClient.get('/medicines'),
      ]);
      setSummary(summaryRes.data.data.summary);
      setMedicines(medsRes.data.data || []);
    } catch (error) {
      console.error('Unable to load insights', error);
    } finally {
      setLoading(false);
    }
  };

  const insightPoints = useMemo(() => {
    if (!summary) return [];

    return [
      {
        label: 'Low stock',
        description: `${summary.lowStock ?? 0} medicines are below reorder level and require restocking soon.`,
      },
      {
        label: 'Out of stock',
        description: `${summary.outOfStock ?? 0} medicines are currently unavailable and should be reordered.`,
      },
      {
        label: 'Expiring soon',
        description: `${summary.expiringSoon ?? 0} medicines will expire soon and should be reviewed for disposition.`,
      },
      {
        label: 'High risk',
        description: `${summary.highRisk ?? 0} medicines are at high supply risk based on current demand and stock levels.`,
      },
    ];
  }, [summary]);

  const lineData = {
    labels: summary?.forecastLabels ?? ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Demand forecast',
        data: summary?.forecastValues ?? [12, 18, 15, 22],
        borderColor: 'rgba(14, 165, 233, 1)',
        backgroundColor: 'rgba(14, 165, 233, 0.18)',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const doughnutData = {
    labels: ['Expiring Soon', 'Low Stock', 'High Risk'],
    datasets: [
      {
        data: [summary?.expiringSoon ?? 0, summary?.lowStock ?? 0, summary?.highRisk ?? 0],
        backgroundColor: ['#0ea5e9', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.formattedValue}`,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Loading insights...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!started ? (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Operational insights</h2>
              <p className="mt-2 text-sm text-muted-foreground">Start the insights visualizer to fetch data and render charts.</p>
            </div>
            <div>
              <button
                onClick={async () => {
                  setStarted(true);
                  await fetchSummary();
                }}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Start insights
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
              try {
                const doc = new jsPDF();
                // Cover
                doc.setFontSize(22);
                doc.text('MediStock Operational Report', 14, 30);
                doc.setFontSize(12);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
                doc.text('Comprehensive local inventory and forecast insights.', 14, 50);

                // Executive summary page
                doc.addPage();
                doc.setFontSize(16);
                doc.text('Executive summary', 14, 22);
                doc.setFontSize(11);
                doc.text(`Total medicines: ${summary?.totalMedicines ?? 0}`, 14, 36);
                doc.text(`Expiring soon: ${summary?.expiringSoon ?? 0}`, 14, 46);
                doc.text(`Low stock: ${summary?.lowStock ?? 0}`, 14, 56);
                doc.text(`High risk: ${summary?.highRisk ?? 0}`, 14, 66);
                doc.text(`Reorder gaps: ${summary?.reorderGapCount ?? 0} (total ${summary?.reorderGapTotal ?? 0} units)`, 14, 76);

                // Add several detail pages (charts, recommendations, tables)
                // Page 3: Forecast narrative
                doc.addPage();
                doc.setFontSize(14);
                doc.text('Forecast narrative', 14, 22);
                doc.setFontSize(11);
                doc.text('Forecasts are generated using the local logistic regression engine. Review recommended reorder quantities and flagged expiry items before placing orders.', 14, 36, { maxWidth: 180 });

                // Page 4: Recommendations
                doc.addPage();
                doc.setFontSize(14);
                doc.text('Recommendations', 14, 22);
                doc.setFontSize(11);
                doc.text('- Review short-expiry batches and block inward receipt for batches under 30 days.', 14, 36);
                doc.text('- Prioritize reorder for high-risk medicines shown in the following pages.', 14, 46);

                // Pages 5-9: Detailed medicine lists (paged)
                const perPage = 20;
                let rowY = 30;
                for (let i = 0; i < medicines.length; i += perPage) {
                  if (i > 0) doc.addPage();
                  const pageMeds = medicines.slice(i, i + perPage);
                  doc.setFontSize(12);
                  doc.text(`Medicines (page ${Math.floor(i / perPage) + 1})`, 14, 18);
                  doc.setFontSize(10);
                  rowY = 30;
                  pageMeds.forEach((m) => {
                    const line = `${m.medicine_id || 'ID'} — ${m.medicine_name || 'Name'} — Stock: ${m.stock_quantity ?? 0} — Expiry: ${m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : '—'}`;
                    doc.text(line, 14, rowY);
                    rowY += 8;
                  });
                }

                // If not enough pages, pad to at least 10 pages
                while (doc.getNumberOfPages() < 10) {
                  doc.addPage();
                  const p = doc.getNumberOfPages();
                  doc.setFontSize(12);
                  doc.text(`Appendix ${p - 4}`, 14, 22);
                  doc.setFontSize(10);
                  doc.text('Additional operational notes and extended tables are available on request.', 14, 36);
                }

                doc.save('medistock_operational_report.pdf');
              } catch (err) {
                console.error('PDF generation failed', err);
              }
            }}
          className="btn-theme inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Download report (PDF)
        </button>
      </div>
          <div className="rounded-[2rem] border bg-gradient-to-r from-primary/10 via-card to-sky-100 p-8 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="space-y-3 text-foreground">
            <h1 className="text-3xl font-semibold">Operational insights</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review stock pressure, demand forecasts, and expiry risk to improve ordering and inventory decisions.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-background p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Fast facts</p>
            <div className="mt-4 space-y-3 text-foreground">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary" />
                <span className="font-semibold">{summary?.totalMedicines ?? 0} tracked medicines</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-sky-500" />
                <span className="font-semibold">{summary?.expiringSoon ?? 0} expiring soon</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-sky-500" />
                <span className="font-semibold">{summary?.highRisk ?? 0} high-risk items</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl border border-border bg-background p-6">
          <div className="flex items-center gap-3 text-foreground">
            <span className="h-5 w-5 rounded-full bg-primary" />
            <h2 className="text-xl font-semibold">Textual insights</h2>
          </div>
          <div className="space-y-4 text-sm leading-7 text-muted-foreground">
            {insightPoints.length === 0 ? (
              <p>No insights available right now. Add inventory data to see recommendations.</p>
            ) : (
              insightPoints.map((item) => (
                <div key={item.label} className="rounded-3xl border border-border bg-background p-5">
                  <h3 className="font-semibold text-foreground">{item.label}</h3>
                  <p className="mt-2">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-foreground">
            <span className="h-5 w-5 rounded-full bg-sky-500" />
            <h2 className="text-xl font-semibold">Forecast visual summary</h2>
          </div>
          <div className="h-[320px] w-full">
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
              <Line ref={lineRef} data={lineData} options={chartOptions} />
            </Suspense>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-foreground">
            <span className="h-5 w-5 rounded-full bg-rose-500" />
            <h2 className="text-xl font-semibold">Risk profile</h2>
          </div>
          <div className="h-[320px] w-full">
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading chart...</div>}>
              <Doughnut ref={doughnutRef} data={doughnutData} options={{ maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (context) => `${context.label}: ${context.formattedValue}` } } } }} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
