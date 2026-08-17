import { useEffect, useState } from 'react';

/**
 * Sign-in page — exact port of the second Claude Design bundle
 * (api.anthropic.com/v1/design/h/IhEzCST7k5UGoxLLcN_uOw).
 *
 *   .na-page
 *     .na-grid       (subtle backdrop grid + radial vignette mask)
 *     .na-glow       (violet glow centered above the card)
 *     .na-main
 *       .na-card
 *         .lk-eyebrow      "— SINGLE SIGN-ON —"
 *         .na-title         "Sign in to <PromptLab>" (kbd-style pill)
 *         .na-lede           workspace pitch
 *         .lk-btn            white "Continue with Lark" button
 *         .lk-foot           "Access restricted to ByteDance users."
 *
 * Once the button is clicked, the idle state is replaced with a
 * three-step progress indicator (Opening Lark → Verifying identity →
 * Granting access) while the OAuth redirect fires — matching the
 * design's `loginProgress` element. We can't observe Lark's internal
 * stages from our side, so the timing is interpolated client-side.
 */

const PROGRESS_STEPS = [
  { key: 'connect', label: 'Opening Lark' },
  { key: 'verify', label: 'Verifying identity' },
  { key: 'grant', label: 'Granting access' },
] as const;

type LoginScreenProps = {
  loading: boolean;
  errorMessage: string;
  onLogin: () => void;
};

export function LoginScreen({ loading, errorMessage, onLogin }: LoginScreenProps) {
  // Once the user clicks "Continue with Lark", we redirect to Lark's
  // authorize endpoint. The redirect is near-instant, but we briefly
  // show the progress UI so the click feels acknowledged. The real
  // post-redirect flow runs server-side; by the time control returns
  // to the SPA the user is either signed in or back here with an
  // `auth_error=` query param.
  const [redirecting, setRedirecting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    if (!redirecting) return;
    // Step the progress indicator forward in three beats. The actual
    // browser redirect is fired immediately by `onLogin`; this is
    // purely cosmetic.
    const step1 = window.setTimeout(() => {
      setStepIndex(1);
      setFill(45);
    }, 400);
    const step2 = window.setTimeout(() => {
      setStepIndex(2);
      setFill(85);
    }, 1100);
    return () => {
      window.clearTimeout(step1);
      window.clearTimeout(step2);
    };
  }, [redirecting]);

  const handleClick = () => {
    if (loading || redirecting) return;
    setRedirecting(true);
    setFill(15);
    onLogin();
  };

  return (
    <div className="na-page">
      <div className="na-grid" />
      <div className="na-glow" />
      <main className="na-main">
        <div className="na-card">
          <div className="na-card-body">
            <div className="lk-eyebrow">
              <span>— Single sign-on —</span>
            </div>
            <h1 className="na-title">
              Sign in to <span className="na-mono">PromptLab</span>
            </h1>
            <p className="na-lede">
              Manage prompt projects, store reusable assets, and run batch testing.
            </p>

            {redirecting ? (
              <div className="lk-progress">
                <div className="lk-progress-bar">
                  <div className="lk-progress-fill" style={{ width: `${fill}%` }} />
                </div>
                <div className="lk-progress-steps">
                  {PROGRESS_STEPS.map((step, i) => {
                    const cls = i < stepIndex ? 'done' : i === stepIndex ? 'active' : '';
                    return (
                      <div key={step.key} className={`lk-step ${cls}`}>
                        <span className="lk-step-dot" />
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  className="lk-btn"
                  disabled={loading}
                  onClick={handleClick}
                >
                  <img src="/assets/lark.png" alt="" className="lk-btn-logo" />
                  {loading ? 'Checking session…' : 'Continue with Lark'}
                </button>
              </div>
            )}

            {errorMessage ? <div className="lk-error">{errorMessage}</div> : null}

            <div className="lk-foot">Access restricted to ByteDance users.</div>
          </div>
        </div>
      </main>
    </div>
  );
}
