// API Configuration
// This file handles the API base URL configuration for different environments

// Available backend servers
export const BACKEND_SERVERS = {
  RAILWAY: 'https://media-harvest-production.up.railway.app',
  RENDER: 'https://media-harvest.onrender.com',
  LOCAL: 'http://localhost:3001'
} as const;

// Get the API base URL from environment variables or user selection
const getApiBaseUrl = (): string => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;
  
  // Check for user-selected backend in localStorage
  const selectedBackend = localStorage.getItem('selectedBackend');
  if (selectedBackend && BACKEND_SERVERS[selectedBackend as keyof typeof BACKEND_SERVERS]) {
    return BACKEND_SERVERS[selectedBackend as keyof typeof BACKEND_SERVERS];
  }
  
  // Get the base URL from environment variables
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Return the appropriate URL
  if (envApiUrl) {
    // Remove trailing slash to prevent double slashes
    return envApiUrl.replace(/\/$/, '');
  }
  
  // Fallback to localhost in development, or current origin in production
  return isDevelopment ? BACKEND_SERVERS.LOCAL : window.location.origin;
};

// Function to switch backend server
export const switchBackendServer = (server: keyof typeof BACKEND_SERVERS): void => {
  localStorage.setItem('selectedBackend', server);
  // Reload the page to apply the new backend
  window.location.reload();
};

// Function to get current backend server
export const getCurrentBackendServer = (): keyof typeof BACKEND_SERVERS | null => {
  const selected = localStorage.getItem('selectedBackend');
  return selected as keyof typeof BACKEND_SERVERS | null;
};

export const API_BASE_URL = getApiBaseUrl();

// API endpoints
export const API_ENDPOINTS = {
  QUALITY_OPTIONS: `${API_BASE_URL}/api/quality-options`,
  DOWNLOAD_VIDEO: `${API_BASE_URL}/api/download-video`,
  CONVERT_VIDEO: `${API_BASE_URL}/api/convert-video`,
  CANCEL_DOWNLOAD: `${API_BASE_URL}/api/cancel-download`,
  HEALTH: `${API_BASE_URL}/api/health`,
  PROBE_AUDIO: `${API_BASE_URL}/api/probe-audio`,
} as const;

// Helper function to create API URLs
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// API Configuration loaded for development