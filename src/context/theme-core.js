import { createContext } from 'react';



export const initialThemeState= {
  theme) => undefined,
  textSize,
  setTextSize) => undefined,
};

export const ThemeProviderContext = createContext(initialThemeState);
