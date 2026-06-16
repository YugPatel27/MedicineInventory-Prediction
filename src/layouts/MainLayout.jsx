import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/useTheme';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { apiClient } from '../api/axios';
import { BrandMark } from '../components/BrandMark';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  LogOut,
  Home,
  Box,
  TrendingUp,
  BarChart3,
  UploadCloud,
  Settings,
  Info,
  Sparkles,
  ShieldCheck,
  Clock,
  Activity,
} from '../components/Icons';
import { ScrollToTop } from '../components/ScrollToTop';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Inventory', href: '/inventory', icon: Box },
  { name: 'Prediction', href: '/predictions', icon: TrendingUp },
  { name: 'Reports', href: '/insights', icon: BarChart3 },
  { name: 'Admin', href: '/admin', icon: ShieldCheck, role: 'Admin' },
  { name: 'Import', href: '/import', icon: UploadCloud },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Sitemap', href: '/sitemap', icon: Info },
];

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState({ expiringSoon: [], lowStock: [] });
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const { data } = await apiClient.get('/medicines/alerts');
        if (!cancelled) setAlerts(data.data || { expiringSoon: [], lowStock: [] });
      } catch (error) {
        // Stop polling on network errors to avoid spamming console
        console.warn('Failed to fetch alerts', error?.message || error);
        if (error?.message?.includes('Network Error') || error?.code === 'ERR_NETWORK') {
          cancelled = true;
          setAlerts({ expiringSoon: [], lowStock: [] });
        }
      }
    };

    fetchAlerts();
    const interval = setInterval(() => {
      if (!cancelled) fetchAlerts();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const totalAlerts = (alerts.expiringSoon?.length || 0) + (alerts.lowStock?.length || 0);

  const navigation = useMemo(
    () => navigationItems.filter((item) => !item.role || user?.role === item.role),
    [user]
  );

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div>
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl px-5 py-4 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <BrandMark />
              <div className="hidden items-center gap-2 rounded-3xl border border-border bg-card px-3 py-2 md:flex">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
              <div className="hidden rounded-2xl border border-border bg-white px-4 py-3 text-sm text-sky-700 shadow-sm md:flex">
                MediStock — Local medicine stock and reorder intelligence
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-3 text-muted-foreground transition hover:bg-primary/5"
                title="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-2xl border border-border bg-card p-2 text-muted-foreground hover:bg-primary/5"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="rounded-2xl border border-border bg-card p-2 text-muted-foreground hover:bg-primary/5"
                >
                  <Bell className="h-5 w-5" />
                </button>
                {totalAlerts > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {totalAlerts}
                  </span>
                )}
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-80 rounded-3xl border border-border bg-card shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="font-semibold text-foreground">Notifications</div>
                      <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-4 space-y-3">
                      {totalAlerts === 0 ? (
                        <div className="text-sm text-muted-foreground">No new alerts at this time.</div>
                      ) : (
                        <>
                          {alerts.expiringSoon
                            .filter((it) => !dismissedNotifications.includes(it.medicine_id))
                            .map((item) => (
                              <div key={item.medicine_id} className="relative rounded-3xl border border-border bg-background p-3">
                                <button
                                  onClick={() => setDismissedNotifications((s) => [...s, item.medicine_id])}
                                  className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                                <div className="flex items-start gap-3">
                                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                                    <Clock className="h-4 w-4" />
                                  </div>
                                  <div className="truncate">
                                    <p className="font-semibold text-foreground truncate">{item.medicine_name} expires soon</p>
                                    <p className="text-xs text-muted-foreground">Expiry: {new Date(item.expiry_date).toLocaleDateString()}</p>
                                  </div>
                                </div>
                              </div>
                            ))}

                          {alerts.lowStock
                            .filter((it) => !dismissedNotifications.includes(it.medicine_id))
                            .map((item) => (
                              <div key={item.medicine_id} className="relative rounded-3xl border border-border bg-background p-3">
                                <button
                                  onClick={() => setDismissedNotifications((s) => [...s, item.medicine_id])}
                                  className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  ✕
                                </button>
                                <div className="flex items-start gap-3">
                                  <div className="rounded-2xl bg-sky-100 p-2 text-sky-700">
                                    <Activity className="h-4 w-4" />
                                  </div>
                                  <div className="truncate">
                                    <p className="font-semibold text-foreground truncate">{item.medicine_name} low stock</p>
                                    <p className="text-xs text-muted-foreground">{item.stock_quantity} remaining</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                <BrandMark compact showText={false} />
              </div>
            </div>
          </div>
          {sidebarOpen && (
            <div className="mt-3 rounded-3xl border border-border bg-card p-4 shadow-sm md:hidden">
              <nav className="space-y-2">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </header>

        <div className="flex-1">
          <main className="min-h-[calc(100vh-84px)] p-5 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
          <footer className="border-t border-border bg-background/95 px-5 py-4 text-sm text-muted-foreground">
            <div className="max-w-6xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>© {new Date().getFullYear()} MediStock — Secure local medicine inventory.</div>
              <div className="flex items-center gap-3">
                <Link to="/legal" className="text-muted-foreground hover:text-foreground">Legal</Link>
                <Link to="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
              </div>
            </div>
          </footer>
          <ScrollToTop />
        </div>
      </div>
    </div>
  );
}
