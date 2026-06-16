import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider } from './context/ThemeContext';
import { MainLayout } from './layouts/MainLayout';

import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Insights } from './pages/Insights';
import { Predictions } from './pages/Predictions';
import { Import } from './pages/Import';
import { Login } from './pages/Login';
import { Legal } from './pages/Legal';
import { Sitemap } from './pages/Sitemap';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { ScrollToTop } from './components/ScrollToTop';
import { CookieBanner } from './components/CookieBanner';
import { ProtectedRoute } from './components/ProtectedRoute';

function AppRoutes() {
  const location = useLocation();

  return (
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/privacy" element={<Navigate to="/legal" replace />} />
        <Route path="/terms" element={<Navigate to="/legal" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/import" element={<Import />} />
            <Route path="/sitemap" element={<Sitemap />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
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
        <Router>
          <AppRoutes />
          <ScrollToTop />
          <CookieBanner />
        </Router>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
