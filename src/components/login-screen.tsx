import { Bot, ImageIcon, PlaySquare, Sparkles } from 'lucide-react';

/**
 * Lark wordmark — simplified geometric "L" glyph in Lark's brand gradient.
 * Inlined as SVG so we don't ship another image asset just for the
 * sign-in button.
 */
function LarkMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="lark-mark">
      <defs>
        <linearGradient id="lark-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D6B9" />
          <stop offset="100%" stopColor="#00B0FF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#lark-gradient)" />
      <path
        d="M9.5 8h2.6v13.2c0 .35.28.6.62.6h9.78v2.6H12.6c-1.71 0-3.1-1.4-3.1-3.1V8Z"
        fill="#ffffff"
      />
    </svg>
  );
}

const featureItems = [
  { icon: Sparkles, className: 'feature-icon-prompts', label: 'Organize prompts by project and version' },
  { icon: ImageIcon, className: 'feature-icon-assets', label: 'Upload and store testing assets' },
  { icon: PlaySquare, className: 'feature-icon-batch', label: 'Batch test different prompts and models' },
];

type LoginScreenProps = {
  loading: boolean;
  errorMessage: string;
  onLogin: () => void;
};

export function LoginScreen({ loading, errorMessage, onLogin }: LoginScreenProps) {
  return (
    <div className="auth-shell">
      <section className="auth-stage">
        <div className="auth-brand-stack">
          <div className="brand-icon auth-brand-icon">
            <Bot size={30} />
          </div>
          <h1>PromptLab</h1>
        </div>

        <div className="auth-card">
          <div className="auth-feature-list">
            {featureItems.map(({ icon: Icon, className, label }) => (
              <div key={label} className="auth-feature-item">
                <Icon size={24} className={className} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="auth-divider">
            <span>Continue With</span>
          </div>

          <button className="auth-lark-button" onClick={onLogin} disabled={loading}>
            <LarkMark />
            <span>{loading ? 'Checking session…' : 'Sign in with Lark'}</span>
          </button>

          {errorMessage ? <div className="auth-inline-error">{errorMessage}</div> : null}
        </div>
      </section>
    </div>
  );
}
