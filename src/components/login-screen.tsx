import { Bot, ImageIcon, PlaySquare, Sparkles } from 'lucide-react';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.225 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.846 1.154 7.959 3.041l5.657-5.657C34.058 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z" />
      <path fill="#FF3D00" d="M6.306 14.691 12.88 19.51C14.655 15.108 18.961 12 24 12c3.059 0 5.846 1.154 7.959 3.041l5.657-5.657C34.058 6.053 29.27 4 24 4c-7.682 0-14.347 4.337-17.694 10.691Z" />
      <path fill="#4CAF50" d="M24 44c5.168 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.149 35.091 26.675 36 24 36c-5.204 0-9.618-3.316-11.283-7.946l-6.524 5.025C9.5 39.556 16.227 44 24 44Z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.084 5.571l.003-.002 6.19 5.238C37.006 38.443 44 33 44 24c0-1.341-.138-2.65-.389-3.917Z" />
    </svg>
  );
}

const featureItems = [
  { icon: Sparkles, className: 'feature-icon-prompts', label: 'Organize prompts by project' },
  { icon: ImageIcon, className: 'feature-icon-assets', label: 'Upload and store testing assets' },
  { icon: PlaySquare, className: 'feature-icon-batch', label: 'Run high-speed batch tests' },
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

          <button className="auth-google-button" onClick={onLogin} disabled={loading}>
            <GoogleMark />
            <span>{loading ? 'Checking Session...' : 'Sign In With Google'}</span>
          </button>

          {errorMessage ? <div className="auth-inline-error">{errorMessage}</div> : null}
        </div>
      </section>
    </div>
  );
}
