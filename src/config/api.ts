// API Configuration
// This file handles the API base URL configuration for different environments
// Updated to support intelligent backend fallback for YouTube downloads

// Backend configuration
// In production (Vercel), use relative URLs to hit serverless functions
// In development, prefer local backend, otherwise allow explicit override via VITE_BACKEND_URL
export const BACKEND_SERVERS = {
  // Use relative URLs in both dev and prod; Vite proxies /api in dev
  LOCAL: '',
  VERCEL: '',
  EXPLICIT: (import.meta.env.VITE_BACKEND_URL as string) || ''
} as const;

// Get the API base URL from environment variables
const getApiBaseUrl = (): string => {
  // Check if we're in development mode or running locally
  const isDevelopment = import.meta.env.DEV;
  console.log('🔌 API Config: Mode=', isDevelopment ? 'Development' : 'Production');

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Explicit override (useful for dev pointing to Railway)
  if (BACKEND_SERVERS.EXPLICIT) {
    let url = BACKEND_SERVERS.EXPLICIT;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    // Remove trailing slash if present to avoid clean concatenation later
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    console.log('🔌 API Config: Using explicit backend URL:', url);
    return url;
  }

  // In development/local, use relative URLs and rely on Vite proxy
  if (isDevelopment && isLocalhost) {
    console.log('🔌 API Config: Using local relative URL (Vite proxy)');
    return BACKEND_SERVERS.LOCAL;
  }

  // In production (Vercel), use serverless functions (relative)
  console.log('🔌 API Config: Using production URL (Vercel/Railway)');
  return BACKEND_SERVERS.VERCEL;
};

// Get fallback API base URL for YouTube downloads when production fails
const getFallbackApiBaseUrl = (): string => {
  const isDevelopment = import.meta.env.DEV;
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Prefer explicit override if set
  if (BACKEND_SERVERS.EXPLICIT) return BACKEND_SERVERS.EXPLICIT;

  // In development, fallback to relative URLs
  if (isDevelopment && isLocalhost) return BACKEND_SERVERS.LOCAL;

  // In production, fallback to serverless routes
  return BACKEND_SERVERS.VERCEL;
};

export const API_BASE_URL = getApiBaseUrl();
export const FALLBACK_API_BASE_URL = getFallbackApiBaseUrl();



// API endpoints
export const API_ENDPOINTS = {
  QUALITY_OPTIONS: `${API_BASE_URL}/api/quality-options`,
  DOWNLOAD_VIDEO: `${API_BASE_URL}/api/download-video`,
  DOWNLOAD_DIRECT: `${API_BASE_URL}/api/download-direct`,
  DOWNLOAD_BLOB: `${API_BASE_URL}/api/download-blob`,
  CONVERT_VIDEO: `${API_BASE_URL}/api/convert-video`,
  CANCEL_DOWNLOAD: `${API_BASE_URL}/api/cancel-download`,
  HEALTH: `${API_BASE_URL}/api/health`,
  PROBE_AUDIO: `${API_BASE_URL}/api/probe-audio`,
  VIDEO_INFO: `${API_BASE_URL}/api/video-info`,
} as const;

// Fallback API endpoints for YouTube downloads
export const FALLBACK_API_ENDPOINTS = {
  QUALITY_OPTIONS: `${FALLBACK_API_BASE_URL}/api/quality-options`,
  DOWNLOAD_VIDEO: `${FALLBACK_API_BASE_URL}/api/download-video`,
  DOWNLOAD_DIRECT: `${FALLBACK_API_BASE_URL}/api/download-direct`,
  DOWNLOAD_BLOB: `${FALLBACK_API_BASE_URL}/api/download-blob`,
  CONVERT_VIDEO: `${FALLBACK_API_BASE_URL}/api/convert-video`,
  CANCEL_DOWNLOAD: `${FALLBACK_API_BASE_URL}/api/cancel-download`,
  HEALTH: `${FALLBACK_API_BASE_URL}/api/health`,
  PROBE_AUDIO: `${FALLBACK_API_BASE_URL}/api/probe-audio`,
  VIDEO_INFO: `${FALLBACK_API_BASE_URL}/api/video-info`,
} as const;

// Helper function to create API URLs
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// API Configuration loaded for development - Updated: 2025-01-04T19:45:00Z