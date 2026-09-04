import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider } from './context/ThemeContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { CartProvider } from './context/CartContext';
import { MainLayout } from './layouts/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Login } from './pages/Login';
import { VerifyEmail } from './pages/VerifyEmail';
import { Legal } from './pages/Legal';
import { ScrollToTop } from './components/ScrollToTop';
import { CookieBanner } from './components/CookieBanner';
import { ProtectedRoute } from './components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Inventory = lazy(() => import('./pages/Inventory').then((module) => ({ default: module.Inventory })));
const Predictions = lazy(() => import('./pages/Predictions').then((module) => ({ default: module.Predictions })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Sitemap = lazy(() => import('./pages/Sitemap').then((module) => ({ default: module.Sitemap })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const Admin = lazy(() => import('./pages/Admin').then((module) => ({ default: module.Admin })));
const Purchases = lazy(() => import('./pages/Purchases').then((module) => ({ default: module.Purchases })));
const Cart = lazy(() => import('./pages/Cart').then((module) => ({ default: module.Cart })));
const Checkout = lazy(() => import('./pages/Checkout').then((module) => ({ default: module.Checkout })));
const Orders = lazy(() => import('./pages/Orders').then((module) => ({ default: module.Orders })));
const OrderDetail = lazy(() => import('./pages/OrderDetail').then((module) => ({ default: module.OrderDetail })));

function RouteFallback() {
  return <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Loading page...</div>;
}

function AppRoutes() {
  const location = useLocation();

  return (
      <Suspense fallback={<RouteFallback />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<MainLayout />}>
          <Route path="/legal" element={<Legal />} />
        </Route>
        <Route path="/privacy" element={<Navigate to="/legal" replace />} />
        <Route path="/terms" element={<Navigate to="/legal" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/sitemap" element={<Sitemap />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
  );
}

function App() {
  React.useEffect(() => {
    // small delay to allow CSS to apply transition
    const t = setTimeout(() => document.body.classList.add('app-visible'), 40);
    return () => clearTimeout(t);
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppSettingsProvider>
          <CartProvider>
            <Router>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
              <ScrollToTop />
              <CookieBanner />
            </Router>
          </CartProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
