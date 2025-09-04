// API Configuration
// This file handles the API base URL configuration for different environments
// Updated to force relative URLs in production

// Available backend servers
export const BACKEND_SERVERS = {
  RAILWAY: 'https://media-tools-production.up.railway.app',
  VPS: 'https://57.129.63.234',
  LOCAL: 'http://localhost:3001'
} as const;

// Get the API base URL from environment variables
const getApiBaseUrl = (): string => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;
  
  // In development, use localhost
  if (isDevelopment) {
    return BACKEND_SERVERS.LOCAL;
  }
  
  // In production, use VPS backend
  // Updated to point to VPS instead of Vercel proxy
  // Force cache refresh: 2025-01-22T20:30:00Z
  return BACKEND_SERVERS.VPS;
};



export const API_BASE_URL = getApiBaseUrl();



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

// Helper function to create API URLs
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// API Configuration loaded for development - Updated: 2025-09-02T18:59:00Z