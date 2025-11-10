const getEnv = (key: string): string | undefined => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === 'string' ? value : undefined;
};

const resolveBrowserOrigin = (): string | undefined => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return undefined;
  }

  return window.location.origin;
};

const buildUrl = (base: string, pathSuffix: string): string => {
  const baseNormalized = base.endsWith('/') ? base.slice(0, -1) : base;
  const suffixNormalized = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  return `${baseNormalized}${suffixNormalized}`;
};

const fallbackOrigin = resolveBrowserOrigin() || 'http://localhost:3001';
const fallbackApiUrl = buildUrl(fallbackOrigin, '/api');
const fallbackAgentsApiUrl = buildUrl(fallbackOrigin, '/api/agents');
const fallbackNodeApiUrl = buildUrl(fallbackOrigin, '/api');

export const API_URL =
  getEnv('VITE_API_URL') ||
  getEnv('VITE_REACT_APP_API_URL') ||
  fallbackApiUrl;

export const AGENTS_API_URL =
  getEnv('VITE_AGENTS_API_URL') ||
  getEnv('VITE_REACT_APP_AGENTS_API_URL') ||
  fallbackAgentsApiUrl;

export const NODE_API_URL =
  getEnv('VITE_NODE_API_URL') ||
  getEnv('VITE_REACT_APP_NODE_API_URL') ||
  fallbackNodeApiUrl;
