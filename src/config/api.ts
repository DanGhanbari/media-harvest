// API Configuration
// This file handles the API base URL configuration for different environments
// Updated to support intelligent backend fallback for YouTube downloads

// Available backend servers
export const BACKEND_SERVERS = {
  VPS: 'http://57.129.63.234:3001',
  LOCAL: 'http://localhost:3001',
  VERCEL: '' // Relative URLs for Vercel serverless functions
} as const;

// Get the API base URL from environment variables
const getApiBaseUrl = (): string => {
  // Check if we're in development mode or running locally
  const isDevelopment = import.meta.env.DEV;
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // In development or local environment, use local backend
  if (isDevelopment && isLocalhost) {
    return BACKEND_SERVERS.LOCAL;
  }

  // In production (Vercel), use relative URLs to go through serverless functions
  return BACKEND_SERVERS.VERCEL;
};

// Get fallback API base URL for YouTube downloads when production fails
const getFallbackApiBaseUrl = (): string => {
  const isDevelopment = import.meta.env.DEV;
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // In development, fallback to VPS if local fails
  if (isDevelopment && isLocalhost) {
    return BACKEND_SERVERS.VPS;
  }
  
  // In production, fallback to VPS if Vercel fails
  return BACKEND_SERVERS.VPS;
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

// Fallback API endpoints for YouTube downloads (uses VPS backend)
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