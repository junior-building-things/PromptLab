import type { Provider } from './types';
import openaiLogo from '../assets/openai.png';
import geminiLogo from '../assets/gemini.png';
import xaiLogo from '../assets/xai.png';

export const providerLabel: Record<Provider, string> = {
  openai: 'OpenAI',
  gemini: 'Google DeepMind',
  xai: 'xAI',
};

const providerIconSrc: Record<Provider, string> = {
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
