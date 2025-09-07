// API Configuration
// This file handles the API base URL configuration for different environments
// Updated to force relative URLs in production

// Available backend servers
export const BACKEND_SERVERS = {
  RAILWAY: 'https://media-tools-production.up.railway.app',
  VPS: 'https://57.129.63.234:3001',
  LOCAL: 'http://localhost:3001'
} as const;

// Get the API base URL from environment variables
const getApiBaseUrl = (): string => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;
  
  // In development, use local backend for testing
  if (isDevelopment) {
    return BACKEND_SERVERS.LOCAL;
  }

  // In production, use VPS server directly
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

// API Configuration loaded for development - Updated: 2025-01-04T19:45:00Z