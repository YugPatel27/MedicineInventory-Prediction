import React, { createContext, useEffect, useState } from 'react';

export const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  textSize: 'base',
  setTextSize: () => {},
});

export function ThemeProvider({ children, defaultTheme = 'light', storageKey = 'mips-ui-theme', ...props }) {
  const [theme, setThemeState] = useState(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw === 'light') return raw;
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
    // Force light theme only — dark mode removed per request
    root.classList.add('light');
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    root.classList.add(`text-${textSize}`);
  }, [textSize]);

  const setTheme = (t) => {
    // Theme switching disabled: keep light theme persistent
    const allowed = 'light';
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
