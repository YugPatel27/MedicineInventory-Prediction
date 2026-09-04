import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/useTheme';
import { useCookieConsent } from '../hooks/useCookieConsent';
import { useAppSettings, DEFAULT_APP_SETTINGS } from '../context/AppSettingsContext';
import { apiClient } from '../api/axios';
import { SEO } from '../components/SEO';
import Alert from '../components/Alert';
import { Reveal } from '../components/Reveal';
import { PageHeader } from '../components/PageHeader';
import { PAGE_IMAGES } from '../assets/pageImages';
import { ShieldCheck, Clock3, Database, Download } from '../components/Icons';

const CURRENCY_OPTIONS = [
  { symbol: '₹', label: 'Indian Rupee (₹)' },
  { symbol: '$', label: 'US Dollar ($)' },
  { symbol: '€', label: 'Euro (€)' },
  { symbol: '£', label: 'British Pound (£)' },
];

export function Settings() {
  const { textSize, setTextSize } = useTheme();
  const { consent, setConsent } = useCookieConsent();
  const { settings, updateSetting, resetSettings } = useAppSettings();

  const [medicines, setMedicines] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [savedFlash, setSavedFlash] = useState('');

  useEffect(() => {
    document.title = 'Settings — MediStock';
    let active = true;
    apiClient
      .get('/medicines')
      .then(({ data }) => {
        if (active) setMedicines(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Live impact preview: shows exactly how many of the CURRENT inventory
  // items would be affected if these thresholds were applied right now —
  // so changing a slider has a visible, measurable consequence instead of
  // being an abstract number.
  const preview = useMemo(() => {
    const nearingExpiry = medicines.filter((m) => {
      if (!m.expiry_date) return false;
      const days = Math.ceil((new Date(m.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= settings.expiryAlertDays;
    }).length;
    const lowStock = medicines.filter((m) => {
      const qty = Number(m.stock_quantity || 0);
      return qty > 0 && qty <= settings.lowStockThreshold;
    }).length;
    return { nearingExpiry, lowStock, total: medicines.length };
  }, [medicines, settings.expiryAlertDays, settings.lowStockThreshold]);

  const flash = (message) => {
    setSavedFlash(message);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setSavedFlash(''), 2500);
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'medistock-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    flash('Settings exported as JSON.');
  };

  const handleClearLocalCache = () => {
    const keysToKeep = new Set(['mips-refresh-token', 'mips-access-token']);
    Object.keys(localStorage)
      .filter((key) => key.startsWith('mips-') && !keysToKeep.has(key))
      .forEach((key) => localStorage.removeItem(key));
    flash('Local preferences and cached UI state cleared (you stay logged in).');
  };

  return (
    <div className="space-y-8">
      <SEO title="Settings — MediStock" description="Configure MediStock inventory thresholds, display, and data preferences." url="/settings" />

      <PageHeader
        eyebrow="Settings"
        title="Preferences & operational rules"
        description="These settings directly change how MediStock evaluates your inventory — expiry alerts, low-stock flags, page sizes, and currency — across the Dashboard, Reports, Inventory, and Purchases pages."
        image={PAGE_IMAGES.warehouseRows}
        imageAlt="Warehouse storage shelves"
      />

      {savedFlash && <Alert type="success">{savedFlash}</Alert>}

      {/* Inventory intelligence thresholds — the highest-impact settings:
          they change what counts as "nearing expiry" or "low stock"
          everywhere in the app, with a live preview against real data. */}
      <Reveal as="section" className="panel-accent p-6" data-accent="amber">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-amber-600" />
          <div>
            <p className="eyebrow-tag">Inventory intelligence</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Expiry &amp; low-stock thresholds</h2>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          These two numbers drive every "nearing expiry" and "low stock" figure across MediStock — the Dashboard KPIs, Reports summary, and Inventory badges all read from here.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="expiryDays" className="text-sm font-semibold text-foreground">Expiry alert window</label>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{settings.expiryAlertDays} days</span>
            </div>
            <input
              id="expiryDays"
              type="range"
              min="7"
              max="120"
              step="1"
              value={settings.expiryAlertDays}
              onChange={(e) => updateSetting('expiryAlertDays', Number(e.target.value))}
              className="mt-3 w-full accent-amber-500"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Medicines expiring within <strong className="text-foreground">{settings.expiryAlertDays} days</strong> are flagged as "nearing expiry".
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              {loadingPreview ? 'Calculating…' : `${preview.nearingExpiry} of ${preview.total} medicines currently match this window.`}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="lowStock" className="text-sm font-semibold text-foreground">Low-stock threshold</label>
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{settings.lowStockThreshold} units</span>
            </div>
            <input
              id="lowStock"
              type="range"
              min="1"
              max="100"
              step="1"
              value={settings.lowStockThreshold}
              onChange={(e) => updateSetting('lowStockThreshold', Number(e.target.value))}
              className="mt-3 w-full accent-rose-500"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Medicines at or below <strong className="text-foreground">{settings.lowStockThreshold} units</strong> are flagged as low stock in Reports.
            </p>
            <p className="mt-1 text-xs font-semibold text-rose-700">
              {loadingPreview ? 'Calculating…' : `${preview.lowStock} of ${preview.total} medicines currently match this threshold.`}
            </p>
          </div>
        </div>
      </Reveal>

      {/* Display & data — formatting/behavioral settings with real effect
          on pagination and currency display. */}
      <Reveal as="section" className="panel p-6">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <div>
            <p className="eyebrow-tag">Display &amp; data</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Tables, currency &amp; text size</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Rows per page</p>
            <p className="mt-1 text-xs text-foreground">Applies to Inventory and Purchases tables.</p>
            <div className="mt-3 flex gap-2 text-black">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSetting('defaultPageSize', size)}
                  className={`rounded-xl px-3 py-2 text-xs text-black font-semibold transition-all duration-200 ${
                    settings.defaultPageSize === size
                      ? 'bg-primary text-black shadow-sm'
                      : 'border border-border text-foreground hover:-translate-y-0.5 hover:bg-primary/5'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Currency</p>
            <p className="mt-1 text-xs text-muted-foreground">Used for purchase order totals and cost figures.</p>
            <select
              value={settings.currencySymbol}
              onChange={(e) => updateSetting('currencySymbol', e.target.value)}
              className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground"
              style={{ colorScheme: 'light' }}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.symbol} value={opt.symbol} className="text-foreground">{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Text size</p>
            <p className="mt-1 text-xs text-muted-foreground">Adjusts readability across the whole app.</p>
            <div className="mt-3 flex gap-2">
              {[
                { key: 'sm', label: 'Small' },
                { key: 'base', label: 'Medium' },
                { key: 'lg', label: 'Large' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => ['sm', 'base', 'lg'].includes(opt.key) && setTextSize(opt.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    textSize === opt.key
                      ? 'bg-primary text-black shadow-sm'
                      : 'border border-border text-muted-foreground hover:-translate-y-0.5 hover:bg-primary/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Data tools — practical, immediately useful operations */}
      <Reveal as="section" className="panel overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <p className="eyebrow-tag">Data tools</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Backup, reset &amp; housekeeping</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Export current settings</h3>
              <p className="text-sm text-muted-foreground">Download your thresholds and preferences as a JSON file to back up or copy to another device.</p>
            </div>
            <button
              onClick={handleExportSettings}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5 sm:w-fit"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Clear local preferences</h3>
              <p className="text-sm text-muted-foreground">Removes cached UI state stored in this browser (theme, filters, dismissed banners). You stay logged in.</p>
            </div>
            <button
              onClick={handleClearLocalCache}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5 sm:w-fit"
            >
              Clear cache
            </button>
          </div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Reset to defaults</h3>
              <p className="text-sm text-muted-foreground">
                Restores expiry window to {DEFAULT_APP_SETTINGS.expiryAlertDays} days, low-stock threshold to {DEFAULT_APP_SETTINGS.lowStockThreshold} units, and all other settings on this page.
              </p>
            </div>
            <button
              onClick={() => {
                resetSettings();
                flash('Settings restored to defaults.');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-100 sm:w-fit"
            >
              Reset all
            </button>
          </div>
        </div>
      </Reveal>

      {/* Privacy & consent — existing feature, restyled */}
      <Reveal as="section" className="panel-accent p-6" data-accent="teal">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <div>
            <p className="eyebrow-tag">Privacy &amp; consent</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Cookie preferences</h2>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your cookie preferences and review the legal policy that governs the app.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { key: 'accepted', label: 'Accept all' },
            { key: 'necessary', label: 'Necessary only' },
            { key: 'declined', label: 'Decline optional' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setConsent(opt.key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                consent === opt.key
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'border border-border text-muted-foreground hover:-translate-y-0.5 hover:bg-teal-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Current consent status: <span className="font-semibold text-foreground">{consent}</span></p>
      </Reveal>
    </div>
  );
}
