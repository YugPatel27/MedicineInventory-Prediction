import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export function Sitemap() {
  useEffect(() => {
    document.title = 'Sitemap — MediStock';
  }, []);

  const routes = [
    { path: '/', title: 'Home' },
    { path: '/dashboard', title: 'Dashboard' },
    { path: '/inventory', title: 'Inventory' },
    { path: '/predictions', title: 'Predictions' },
    { path: '/settings', title: 'Settings' },
    { path: '/login', title: 'Login' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <span className="w-8 h-8 text-primary">M</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sitemap</h1>
          <p className="text-muted-foreground mt-1">Navigate across the MediStock application.</p>
        </div>
      </div>

      <div className="bg-card shadow-sm border rounded-xl p-8">
        <div className="mb-6 rounded-2xl border bg-muted/30 p-5">
          <h2 className="text-lg font-semibold text-foreground">Software description</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            MediStock is a local-first medicine operations platform combining inventory, expiry tracking, forecasting, alerts, reporting, and admin controls.
          </p>
        </div>

        <ul className="space-y-3">
          {routes.map((route) => (
            <li key={route.path}>
              <Link to={route.path} className="group flex items-center justify-between p-4 rounded-lg hover:bg-muted/5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{route.path}</span>
                  <span className="font-semibold text-lg text-primary">{route.title}</span>
                </div>
                <div className="text-muted-foreground">→</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}