// API Configuration
// This file handles the API base URL configuration for different environments

// Get the API base URL from environment variables
// In development: uses local backend (http://localhost:3001)
// In production: uses the deployed backend URL (e.g., Railway)
const getApiBaseUrl = (): string => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;
  
  // Get the base URL from environment variables
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Return the appropriate URL
  if (envApiUrl) {
    // Remove trailing slash to prevent double slashes
    return envApiUrl.replace(/\/$/, '');
  }
  
  // Fallback to localhost in development, or current origin in production
  return isDevelopment ? 'http://localhost:3001' : window.location.origin;
};

export const API_BASE_URL = getApiBaseUrl();

// API endpoints
export const API_ENDPOINTS = {
  QUALITY_OPTIONS: `${API_BASE_URL}/api/quality-options`,
  DOWNLOAD_VIDEO: `${API_BASE_URL}/api/download-video`,
  CANCEL_DOWNLOAD: `${API_BASE_URL}/api/cancel-download`,
  HEALTH: `${API_BASE_URL}/api/health`,
} as const;

// Helper function to create API URLs
export const createApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// API Configuration loaded for development