// Test script to verify API configuration
import { API_BASE_URL, API_ENDPOINTS } from './src/config/api.ts';

console.log('=== API Configuration Test ===');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('VIDEO_INFO endpoint:', API_ENDPOINTS.VIDEO_INFO);
console.log('Environment VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL);
console.log('================================');