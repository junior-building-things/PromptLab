import type { Provider } from './types';

export const providerLabel: Record<Provider, string> = {
  openai: 'OpenAI',
  gemini: 'Google DeepMind',
  xai: 'xAI',
};

const providerIconSrc: Record<Provider, string> = {
  openai: '/openai.png?v=3',
  gemini: '/gemini.png?v=3',
  xai: '/xai.png?v=3',
};

export function getProviderLabel(provider: Provider) {
  return providerLabel[provider];
}

export function getProviderIconSrc(provider: Provider) {
  return providerIconSrc[provider];
}
