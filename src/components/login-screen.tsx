/**
 * Login screen — re-skinned to match the Claude Design PromptLab.html
 * aesthetic: dotted radial background, frosted dark card, violet AI
 * accent. The brand mark up top gets the same 3.2 s breathing glow as
 * the sidebar's `.brand-mark` so the auth screen feels like part of the
 * app rather than a separate Google-OAuth landing page.
 */

function LarkMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" style={{ width: 22, height: 22 }}>
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

type LoginScreenProps = {
  loading: boolean;
  errorMessage: string;
  onLogin: () => void;
};

export function LoginScreen({ loading, errorMessage, onLogin }: LoginScreenProps) {
  return (
    <>
      <div className="app-bg" />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '40px',
        }}
      >
        <div
          style={{
            width: 'min(420px, 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            className="brand-mark"
            style={{ width: 56, height: 56, borderRadius: 14 }}
          >
            <img
              src="/assets/app-icon.png"
              alt="PromptLab"
              style={{ width: '100%', height: '100%', borderRadius: 11, display: 'block' }}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text)',
              }}
            >
              PromptLab
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-dim)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              v2.2 · Prompt management
            </div>
          </div>

          <div
            className="modal"
            style={{
              width: '100%',
              background: 'var(--panel)',
              backdropFilter: 'blur(20px) saturate(140%)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              borderRadius: 'var(--r-xl)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-dim)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              Sign in to continue
            </div>
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={onLogin}
              style={{
                height: 44,
                fontSize: 13.5,
                fontWeight: 500,
                width: '100%',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <LarkMark />
              {loading ? 'Checking session…' : 'Sign in with Lark'}
            </button>
            {errorMessage ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid oklch(0.72 0.18 22 / 0.4)',
                  background: 'oklch(0.72 0.18 22 / 0.1)',
                  color: 'var(--rose)',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
