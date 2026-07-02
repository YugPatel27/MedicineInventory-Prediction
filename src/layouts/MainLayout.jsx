import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { apiClient } from '../api/axios';
import { BrandMark } from '../components/BrandMark';
import { Menu, LogOut, Home, Box, BarChart3, UploadCloud, Settings, TrendingUp, Database } from '../components/Icons';
import { ScrollToTop } from '../components/ScrollToTop';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Medicines', href: '/medicines', icon: Box, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Inventory', href: '/inventory', icon: Database, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Categories', href: '/categories', icon: BarChart3, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Suppliers', href: '/suppliers', icon: UploadCloud, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Purchases', href: '/purchases', icon: UploadCloud, roles: ['Admin', 'Manager'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Prediction Insights', href: '/insights', icon: TrendingUp, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Forecast', href: '/predictions', icon: Database, roles: ['Admin', 'Manager', 'Pharmacist'] },
  { name: 'Admin Panel', href: '/admin', icon: Settings, roles: ['Admin'] },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const navigation = useMemo(() => {
    const role = user?.role || 'User';
    return navigationItems.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(role);
    });
  }, [user]);

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('mips-refresh-token');
      await apiClient.post('/auth/logout', { refresh_token: refresh });
    } catch {
      // Local logout should still work if the API is unavailable.
    } finally {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BrandMark />
            <div className="hidden items-center gap-2 rounded-3xl border border-border bg-card px-3 py-2 md:flex">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/10'
                        : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground md:hidden"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-3 text-muted-foreground transition hover:bg-primary/5 hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>

            <div className="hidden rounded-2xl border border-border bg-white px-4 py-3 text-sm text-sky-700 shadow-sm md:flex">
              MediStock - Local medicine stock and reorder intelligence
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div className="mx-auto mt-3 max-w-7xl rounded-3xl border border-border bg-card p-4 shadow-sm md:hidden">
            <nav className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`block rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              >
                Logout
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 p-5 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-background px-5 py-4 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} MediStock - Secure local medicine inventory.</div>
          <div className="flex items-center gap-3">
            <Link to="/legal" className="text-muted-foreground hover:text-foreground">Legal</Link>
            <Link to="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
          </div>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}
