import type { CSSProperties } from 'react';

/**
 * Inline SVG icon set lifted from the Claude Design PromptLab.html mockup.
 * Same paths / stroke widths — kept as React components so they hot-reload
 * and inherit `currentColor` from the parent text color. The provider
 * marks (OpenAI / Google / xAI / Alibaba) are real PNGs that live under
 * `public/assets/` with the design's exact filename, so the CSS selectors
 * (`.provider-img`, `.provider-img-colored`) wire up unchanged.
 */

const baseStyle: CSSProperties = { width: '100%', height: '100%' };

/** Fixed-size slot so every icon lands on the same optical box
 * regardless of which glyph it holds. Pages used to each carry their own
 * copy of this. */
export function IconBox({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

export const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const IconFilter = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M4 5h16M7 12h10M10 19h4" />
  </svg>
);

export const IconChev = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconMore = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={baseStyle}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);

export const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M15 4l5 5-11 11H4v-5z" />
    <path d="M14 5l5 5" />
  </svg>
);

export const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </svg>
);

export const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

export const IconSpinner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={baseStyle}>
    <path d="M12 3a9 9 0 1 0 9 9" strokeOpacity="0.85" />
  </svg>
);

export const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const IconCpu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
  </svg>
);

export const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

export const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12 21 2M16 7l4 4" />
  </svg>
);

export const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M12 4v12M6 12l6-6 6 6M4 20h16" />
  </svg>
);

export const IconText = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M3 17l5-4 6 5 7-6" />
  </svg>
);

export const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <path d="M17 9l4-2v10l-4-2z" />
  </svg>
);

export const IconStickerize = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={baseStyle}>
    <path d="M5 7l7-3 7 3v6c0 4-3 7-7 8-4-1-7-4-7-8z" />
  </svg>
);

/** Provider mark — picks the correct PNG + filter class. Google + Alibaba
 * are colored so they keep their native palette via `colored`. xAI keeps
 * its monochrome mark inverted to white in dark mode (CSS filter). OpenAI
 * ships two assets: the dark-on-light original plus a `_darkmode` white
 * variant — we render both and let CSS toggle visibility by theme so we
 * avoid the lossy `filter: invert(1)` hack. */
export function ProviderMark({ provider }: { provider: 'openai' | 'google' | 'xai' | 'alibaba' }) {
  if (provider === 'openai') {
    return (
      <>
        <img
          src="/assets/openai.png"
          alt="openai"
          className="provider-img provider-img-openai provider-img-openai-light"
        />
        <img
          src="/assets/openai_darkmode.png"
          alt="openai"
          className="provider-img provider-img-openai provider-img-openai-dark"
        />
      </>
    );
  }
  const colored = provider === 'google' || provider === 'alibaba';
  return (
    <img
      src={`/assets/${provider}.png`}
      alt={provider}
      className={`provider-img${colored ? ' provider-img-colored' : ''}`}
    />
  );
}

/** Resolve a model id string back to its provider so we can show the
 * right mark next to model names in the batch matrix + dropdowns. */
export function providerForModelId(id: string): 'openai' | 'google' | 'xai' | 'alibaba' | null {
  const n = id.toLowerCase();
  if (n.startsWith('gpt-') || n.startsWith('sora') || n.includes('openai')) return 'openai';
  if (n.startsWith('gemini') || n.startsWith('veo') || n.includes('nano banana')) return 'google';
  if (n.startsWith('grok')) return 'xai';
  if (n.startsWith('qwen')) return 'alibaba';
  return null;
}
