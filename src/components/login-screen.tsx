import { Bot, Lock, ShieldCheck } from 'lucide-react';

type LoginScreenProps = {
  loading: boolean;
  errorMessage: string;
  onLogin: () => void;
};

export function LoginScreen({ loading, errorMessage, onLogin }: LoginScreenProps) {
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">
          <div className="brand-icon">
            <Bot size={22} />
          </div>
          <div>
            <h1>PromptLab</h1>
          </div>
        </div>

        <div className="auth-copy">
          <span className="auth-badge">
            <ShieldCheck size={15} />
            Lark SSO
          </span>
          <h2>Sign In To PromptLab</h2>
          <p>Each PromptLab workspace is now isolated to the authenticated Lark user in this browser.</p>
        </div>

        {errorMessage ? (
          <div className="auth-error">
            <Lock size={16} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <button className="button button-primary auth-button" onClick={onLogin} disabled={loading}>
          {loading ? 'Checking Session...' : 'Continue With Lark'}
        </button>
      </section>
    </div>
  );
}
