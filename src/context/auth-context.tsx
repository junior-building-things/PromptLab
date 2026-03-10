import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { SessionResponse, SessionUser } from '../lib/auth';

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  errorMessage: string;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(code: string) {
  switch (code) {
    case 'missing_config':
      return 'Lark SSO is not configured yet. Add the Lark app credentials and session secret in Vercel.';
    case 'invalid_state':
      return 'The Lark sign-in flow expired or was interrupted. Try again.';
    case 'access_denied':
      return 'The Lark sign-in request was cancelled or denied.';
    case 'oauth_failed':
      return 'Lark sign-in failed during token exchange.';
    default:
      return 'Lark sign-in failed.';
  }
}

function consumeAuthErrorFromUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  const errorCode = url.searchParams.get('auth_error');
  if (!errorCode) {
    return '';
  }

  url.searchParams.delete('auth_error');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return mapAuthError(errorCode);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const payload = (await response.json()) as SessionResponse;

      if (!response.ok) {
        setUser(null);
        setErrorMessage(payload.error || 'Failed to check the current session.');
        return;
      }

      setUser(payload.authenticated ? payload.user || null : null);
      setErrorMessage((current) => {
        if (payload.error) {
          return payload.error;
        }

        if (!payload.authenticated) {
          return current;
        }

        return '';
      });
    } catch {
      setUser(null);
      setErrorMessage('Failed to connect to the authentication service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const authError = consumeAuthErrorFromUrl();
    if (authError) {
      setErrorMessage(authError);
    }

    void refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.assign('/api/auth/lark/login');
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setErrorMessage('');
      window.location.assign('/');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      errorMessage,
      login,
      logout,
      refresh,
    }),
    [errorMessage, loading, login, logout, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
