import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { apiClient } from '../api/axios';
import { useCart } from '../context/CartContext';
import { BrandMark } from '../components/BrandMark';
import { Menu, LogOut, Home, BarChart3, UploadCloud, Settings, Database, ShoppingCart, PackageCheck, X, UserCircle, ChevronDown } from '../components/Icons';
import { ScrollToTop } from '../components/ScrollToTop';

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'Overview & KPIs' },
  { name: 'Inventory', href: '/inventory', icon: Database, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'Stock & batches' },
  { name: 'Purchases', href: '/purchases', icon: UploadCloud, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'Vendor orders' },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'PDF & exports' },
  { name: 'Forecast', href: '/predictions', icon: Database, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'Demand prediction' },
  { name: 'Admin Panel', href: '/admin', icon: Settings, roles: ['Admin'], description: 'Audit & activity' },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['Admin', 'Manager', 'Pharmacist', 'User'], description: 'Preferences' },
];

// Billing-related pages live under the profile dropdown instead of the main
// nav row, so the row doesn't compete for space with Cart/Orders on every
// screen size.
const profileLinks = [
  { name: 'Cart', href: '/cart', icon: ShoppingCart, description: 'Billing selection', badgeKey: 'cart' },
  { name: 'Orders', href: '/orders', icon: PackageCheck, description: 'Billing & status' },
];

const HEADER_HEIGHT = 76;

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { totalItems } = useCart();
  const profileRef = useRef(null);

  const navigation = useMemo(() => {
    const role = user?.role || 'User';
    return navigationItems.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(role);
    });
  }, [user]);

  // Navbar stays fixed and always visible; we only track scroll position
  // to add a subtle elevation shadow once the page has scrolled.
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile drawer whenever the route changes, so navigating never
  // leaves it open behind the new page.
  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Lock background scroll while the mobile drawer is open, and let Escape
  // close it — standard drawer behaviour that mobile users expect.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sidebarOpen]);

  // Close the profile dropdown on an outside click or Escape — the same
  // dismissal behaviour the mobile drawer already uses above.
  useEffect(() => {
    if (!profileOpen) return undefined;
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

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
      <header
        className={`fixed inset-x-0 top-0 z-40 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 transition-shadow duration-300 ease-out ${
          scrolled ? 'shadow-lg shadow-emerald-900/20' : 'shadow-md shadow-emerald-900/10'
        }`}
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-emerald-300 via-white/70 to-emerald-300" aria-hidden />

        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-8">
            <BrandMark theme="dark" />

            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    title={item.description}
                    className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/15 text-white shadow-inner'
                        : 'text-emerald-120/100 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 transition-colors ${isActive ? 'text-white' : 'text-emerald-200/80 group-hover:text-white'}`} />
                    {item.name}
                    {item.badgeKey === 'cart' && totalItems > 0 && (
                      <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-emerald-950">
                        {totalItems}
                      </span>
                    )}
                    <span
                      className={`absolute inset-x-3 -bottom-[3px] h-[2.5px] rounded-full bg-emerald-200 transition-all duration-200 ${
                        isActive ? 'opacity-100 scale-x-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-60'
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className={`flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3 text-sm font-semibold text-white ring-1 transition-all duration-200 ${
                  profileOpen ? 'bg-white/20 ring-white/25' : 'bg-white/10 ring-white/15 hover:bg-white/15'
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                  <UserCircle className="h-5 w-5 text-white" />
                </span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{user?.name || 'Account'}</span>
                {totalItems > 0 && (
                  <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-emerald-950">
                    {totalItems}
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-emerald-100 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              <div
                role="menu"
                className={`absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right rounded-2xl border border-emerald-100 bg-white p-2 text-foreground shadow-xl shadow-emerald-950/10 transition-all duration-150 ${
                  profileOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
                }`}
              >
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <UserCircle className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-emerald-950">{user?.name || 'Account'}</p>
                    <p className="text-xs text-emerald-700">{user?.role || 'User'}</p>
                  </div>
                </div>

                <div className="my-2 border-t border-border" />

                {profileLinks.map((item) => {
                  const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      <item.icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="flex-1">{item.name}</span>
                      {item.badgeKey === 'cart' && totalItems > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-emerald-950">
                          {totalItems}
                        </span>
                      )}
                    </Link>
                  );
                })}

                <div className="my-2 border-t border-border" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  Logout
                </button>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 md:hidden"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

      </header>

      {/* Mobile drawer: backdrop + slide-in panel, rendered outside the fixed
          header so it can cover the full viewport height regardless of scroll. */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <nav
          aria-label="Mobile primary"
          className={`absolute inset-y-0 right-0 flex h-full w-[82%] max-w-xs flex-col bg-emerald-900 shadow-2xl transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <BrandMark theme="dark" />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <UserCircle className="h-7 w-7 text-white" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name || 'Account'}</p>
              <span className="mt-0.5 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-white/15">
                {user?.role || 'User'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 px-3 pt-3">
            {profileLinks.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex flex-1 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-emerald-100/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-emerald-200/80'}`} />
                  {item.name}
                  {item.badgeKey === 'cart' && totalItems > 0 && (
                    <span className="absolute right-2 top-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-emerald-950">
                      {totalItems}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mx-5 my-3 border-t border-white/10" />

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-[15px] font-medium transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-emerald-200/80'}`} />
                  <span className="flex-1">{item.name}</span>
                  {item.badgeKey === 'cart' && totalItems > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-emerald-950">
                      {totalItems}
                    </span>
                  )}
                  {isActive && <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden />}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-white/10 px-3 py-3">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] font-medium text-rose-200 hover:bg-rose-500/10"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </nav>
      </div>

      {/* Spacer so fixed header never overlaps page content */}
      <div style={{ height: HEADER_HEIGHT }} aria-hidden />

      <main className="flex-1 p-5 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <footer className="bg-gradient-to-b from-emerald-900 to-emerald-950 text-emerald-100">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <BrandMark theme="dark" />
              <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-100/90">
                Real-time inventory intelligence for pharmacies — expiry tracking, demand forecasting, and purchase
                management in one secure dashboard.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Workspace</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/dashboard" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-gauge-high w-4 text-center text-emerald-300" aria-hidden="true" />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/inventory" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-boxes-stacked w-4 text-center text-emerald-300" aria-hidden="true" />
                    Inventory
                  </Link>
                </li>
                <li>
                  <Link to="/purchases" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-truck-fast w-4 text-center text-emerald-300" aria-hidden="true" />
                    Purchases
                  </Link>
                </li>
                <li>
                  <Link to="/reports" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-chart-column w-4 text-center text-emerald-300" aria-hidden="true" />
                    Reports
                  </Link>
                </li>
                <li>
                  <Link to="/predictions" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-chart-line w-4 text-center text-emerald-300" aria-hidden="true" />
                    Forecast
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Resources</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/settings" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-sliders w-4 text-center text-emerald-300" aria-hidden="true" />
                    Settings
                  </Link>
                </li>
                <li>
                  <Link to="/legal" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-scale-balanced w-4 text-center text-emerald-300" aria-hidden="true" />
                    Legal &amp; privacy
                  </Link>
                </li>
                <li>
                  <Link to="/sitemap" className="inline-flex items-center gap-2.5 text-emerald-100/90 transition hover:text-white">
                    <i className="fa-solid fa-sitemap w-4 text-center text-emerald-300" aria-hidden="true" />
                    Sitemap
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-emerald-100/80 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} MediStock — Medicine Stock Intelligence. Secure local medicine inventory.</p>
          </div>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}
