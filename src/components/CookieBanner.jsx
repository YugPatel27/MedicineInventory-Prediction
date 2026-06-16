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
      <div className="max-w-4xl mx-auto rounded-2xl border bg-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{getBannerCopy(consent)} Learn more in our <Link to="/legal" className="font-semibold text-primary">legal page</Link>.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setConsent('accepted')} className="rounded-2xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Accept all</button>
          <button onClick={() => setConsent('necessary')} className="rounded-2xl border px-4 py-2 text-sm">Necessary only</button>
          <button onClick={() => setConsent('declined')} className="rounded-2xl border border-sky-200 px-4 py-2 text-sm text-sky-800">Decline</button>
        </div>
      </div>
    </div>
  );
}