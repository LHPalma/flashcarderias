import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/doto/wght.css';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/share-tech-mono/latin-400.css';
import { App } from './App';
import { applyTheme, storedTheme } from './theme';
import './styles.css';

applyTheme(storedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
