import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyStoredTheme } from './lib/theme';
import './styles.css';

// Before first paint, so the login screen (which mounts outside
// AppLayout) never flashes dark on a light-mode machine.
applyStoredTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
