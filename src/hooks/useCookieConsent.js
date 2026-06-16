import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mips-cookie-consent';

const readStoredConsent = () => {
  if (typeof window === 'undefined') {
    return 'undecided';
  }

  const value = localStorage.getItem(STORAGE_KEY);
  if (value === 'accepted' || value === 'necessary' || value === 'declined') {
    return value;
  }
  return 'undecided';
};

const hasConsentedValue = (consent) => consent === 'accepted' || consent === 'necessary';

export const useCookieConsent = () => {
  const [consent, setConsentState] = useState(() => readStoredConsent());

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        setConsentState(readStoredConsent());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setConsent = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setConsentState(next);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, []);

  return {
    consent,
    setConsent,
    hasConsented: hasConsentedValue(consent),
  };
};

