import type { Provider } from './types';
import openaiLogo from '../assets/openai.png';
import geminiLogo from '../assets/gemini.png';
import xaiLogo from '../assets/xai.png';

export const providerLabel: Record<Provider, string> = {
  openai: 'OpenAI',
  gemini: 'Google DeepMind',
  anthropic: 'Anthropic',
  xai: 'xAI',
};

/** Anthropic has no PNG asset in the repo — it renders as a monogram
 * mark instead (see ProviderMarkInline), so this map is partial. */
const providerIconSrc: Partial<Record<Provider, string>> = {
  openai: openaiLogo,
  gemini: geminiLogo,
  xai: xaiLogo,
};

export function getProviderLabel(provider: Provider) {
  return providerLabel[provider];
}

export function getProviderIconSrc(provider: Provider) {
  return providerIconSrc[provider];
}

/** Category names shared by the API Keys tab and the batch-test model
 * dropdown, so the two can't drift apart. */
export const MODEL_CATEGORY_LABELS = {
  text: 'Text & Visual Reasoning',
  image: 'Image Generation',
  video: 'Video Generation',
} as const;
