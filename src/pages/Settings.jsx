import { useEffect } from 'react';
import { useTheme } from '../context/useTheme';
import { useCookieConsent } from '../hooks/useCookieConsent';

export function Settings() {
  const { theme, setTheme, textSize, setTextSize } = useTheme();
  const { consent, setConsent } = useCookieConsent();

  const safeSetTheme = (t) => {
    if (['light', 'dark', 'system'].includes(t)) setTheme(t);
  };
  const safeSetTextSize = (s) => {
    if (['sm', 'base', 'lg'].includes(s)) setTextSize(s);
  };

  useEffect(() => {
    document.title = 'Settings — MediStock';
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <span className="w-8 h-8 text-primary">S</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your application preferences and UI theme.</p>
        </div>
      </div>

      <div className="bg-card shadow-sm border rounded-xl p-8 space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Appearance (Theme)</h3>
          <div className="flex gap-3">
            <button onClick={() => safeSetTheme('light')} className={`p-3 rounded border ${theme === 'light' ? 'border-primary' : ''}`}>Light</button>
            <button onClick={() => safeSetTheme('dark')} className={`p-3 rounded border ${theme === 'dark' ? 'border-primary' : ''}`}>Dark</button>
            <button onClick={() => safeSetTheme('system')} className={`p-3 rounded border ${theme === 'system' ? 'border-primary' : ''}`}>System</button>
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Typography (Text Size)</h3>
          <div className="flex gap-3">
            <button onClick={() => safeSetTextSize('sm')} className={`p-3 rounded border ${textSize === 'sm' ? 'border-primary' : ''}`}>Small</button>
            <button onClick={() => safeSetTextSize('base')} className={`p-3 rounded border ${textSize === 'base' ? 'border-primary' : ''}`}>Medium</button>
            <button onClick={() => safeSetTextSize('lg')} className={`p-3 rounded border ${textSize === 'lg' ? 'border-primary' : ''}`}>Large</button>
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Privacy & Consent</h3>
          <p className="text-sm text-muted-foreground mb-4">Manage your cookie preferences and review the legal policy that governs the app.</p>
          <div className="flex gap-3">
            <button onClick={() => setConsent('accepted')} className={`p-3 rounded border ${consent === 'accepted' ? 'border-primary' : ''}`}>Accept all</button>
            <button onClick={() => setConsent('necessary')} className={`p-3 rounded border ${consent === 'necessary' ? 'border-primary' : ''}`}>Necessary only</button>
            <button onClick={() => setConsent('declined')} className={`p-3 rounded border ${consent === 'declined' ? 'border-primary' : ''}`}>Decline optional</button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Current consent status: <span className="font-semibold text-foreground">{consent}</span></p>
        </section>
      </div>
    </div>
  );
}
