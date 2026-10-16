export * from './constants';

/**
 * Single source of truth for the API base URL.
 * Strictly driven by the environment variable VITE_API_URL without hardcoded code crutches.
 */
const rawEnvUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL: string = (() => {
  if (rawEnvUrl && rawEnvUrl.trim()) {
    const trimmed = rawEnvUrl.trim();
    if (trimmed.startsWith('/')) return trimmed; // Relative proxy URL (e.g. /api in dev)
    return trimmed.replace(/\/$/, '') + (trimmed.endsWith('/api') ? '' : '/api');
  }
  // Default relative proxy for development or same-origin deployments
  return '/api';
})();
