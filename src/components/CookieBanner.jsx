import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCookieConsent } from '../hooks/useCookieConsent';

const getBannerCopy = (consent) => {
  if (consent === 'declined') {
    return 'You have declined optional cookies. Essential preferences remain saved locally, and you can change your decision anytime.';
  }

  if (consent === 'necessary') {
    return 'Only the essential cookies required to keep your preferences and session active are enabled.';
  }

  return 'We use cookies and local storage to store preferences, improve usability, and show legal notices. Review our policy before continuing.';
};

export function CookieBanner() {
  const { consent, setConsent } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consent === 'undecided' || consent === 'declined');
  }, [consent]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl shadow-emerald-950/15 md:flex-row">
        <div className="flex-1">
          <p className="text-sm text-slate-600">{getBannerCopy(consent)} Learn more in our <Link to="/legal" className="font-semibold text-emerald-700 hover:text-emerald-800">legal page</Link>.</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button onClick={() => setConsent('accepted')} className="rounded-2xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 transition hover:bg-emerald-900">Accept all</button>
          <button onClick={() => setConsent('necessary')} className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-emerald-50">Necessary only</button>
          <button onClick={() => setConsent('declined')} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100">Decline</button>
        </div>
      </div>
    </div>
  );
}