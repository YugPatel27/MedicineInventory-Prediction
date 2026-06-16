import React, { createContext, useEffect, useState } from 'react';

export const ThemeContext = createContext({
  theme: 'system',
  setTheme: () => {},
  textSize: 'base',
  setTextSize: () => {},
});

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'mips-ui-theme', ...props }) {
  const [theme, setThemeState] = useState(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    return defaultTheme;
  });

  const [textSize, setTextSizeState] = useState(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`${storageKey}-text`) : null;
    if (raw === 'sm' || raw === 'base' || raw === 'lg') return raw;
    return 'base';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    root.classList.add(`text-${textSize}`);
  }, [textSize]);

  const setTheme = (t) => {
    const allowed = ['light', 'dark', 'system'].includes(t) ? t : 'system';
    localStorage.setItem(storageKey, allowed);
    setThemeState(allowed);
  };

  const setTextSize = (s) => {
    const allowed = ['sm', 'base', 'lg'].includes(s) ? s : 'base';
    localStorage.setItem(`${storageKey}-text`, allowed);
    setTextSizeState(allowed);
  };

  const value = { theme, setTheme, textSize, setTextSize };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
