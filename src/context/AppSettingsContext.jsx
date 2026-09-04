import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'medistock-app-settings';

export const DEFAULT_APP_SETTINGS = {
  expiryAlertDays: 30, // window used everywhere "expiring soon" is calculated
  lowStockThreshold: 10, // stock at/below this is flagged low
  defaultPageSize: 20, // rows per page across Inventory & Purchases tables
  currencySymbol: '₹', // used on every price/cost figure in Purchases & Reports
  autoRefreshMinutes: 0, // 0 = off; Dashboard/Inventory can auto re-fetch
  compactTables: false, // tighter row padding across data tables
};

const AppSettingsContext = createContext({
  settings: DEFAULT_APP_SETTINGS,
  updateSetting: () => {},
  resetSettings: () => {},
});

const readStored = () => {
  if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
