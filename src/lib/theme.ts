/**
 * Theme resolution, shared by the app shell and the pre-render bootstrap
 * in `main.tsx`. Applying it before first paint is what keeps the login
 * screen — which mounts outside `AppLayout` — from flashing dark for a
 * frame on a light-mode machine.
 *
 * PromptLab's palette lives at bare `:root` (dark) with light behind
 * `[data-theme="light"]`, so "dark" means removing the attribute.
 */

export type ThemeMode = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'promptlab-theme';

export function readThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
}

export function storeThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (resolveTheme(mode) === 'dark') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', 'light');
}

export function applyStoredTheme() {
  applyTheme(readThemeMode());
}
