const getEnv = (key: string): string | undefined => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === 'string' ? value : undefined;
};

export const API_URL =
  getEnv('VITE_API_URL') ||
  getEnv('VITE_REACT_APP_API_URL') ||
  'http://localhost:3001/api';

export const AGENTS_API_URL =
  getEnv('VITE_AGENTS_API_URL') ||
  getEnv('VITE_REACT_APP_AGENTS_API_URL') ||
  'http://localhost:8000';

export const NODE_API_URL =
  getEnv('VITE_NODE_API_URL') ||
  getEnv('VITE_REACT_APP_NODE_API_URL') ||
  'http://localhost:5001/api';
