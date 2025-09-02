#!/usr/bin/env node

// API Testing Script for VPS Backend
// Run this script to test all API endpoints on your VPS

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const VPS_IP = process.argv[2] || 'YOUR_VPS_IP';
const BASE_URL = `http://${VPS_IP}:3001`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.cyan}[TEST]${colors.reset} ${msg}`)
};

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VPS-API-Tester/1.0',
        ...options.headers
      },
      timeout: 10000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test functions
async function testHealthEndpoint() {
  log.test('Testing health endpoint...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      log.success('Health endpoint is working');
      console.log('  Response:', response.data);
      return true;
    } else {
      log.error(`Health endpoint returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    log.error(`Health endpoint failed: ${error.message}`);
    return false;
  }
}

async function testVideoInfoEndpoint() {
  log.test('Testing video info endpoint...');
  try {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll for testing
    const response = await makeRequest(`${BASE_URL}/api/video-info`, {
      method: 'POST',
      body: { url: testUrl }
    });
    
    if (response.status === 200) {
      log.success('Video info endpoint is working');
      console.log('  Video title:', response.data.title || 'N/A');
      console.log('  Duration:', response.data.duration || 'N/A');
      return true;
    } else {
      log.error(`Video info endpoint returned status ${response.status}`);
      console.log('  Response:', response.data);
      return false;
    }
  } catch (error) {
    log.error(`Video info endpoint failed: ${error.message}`);
    return false;
  }
}

async function testQualityOptionsEndpoint() {
  log.test('Testing quality options endpoint...');
  try {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const response = await makeRequest(`${BASE_URL}/api/quality-options`, {
      method: 'POST',
      body: { url: testUrl }
    });
    
    if (response.status === 200) {
      log.success('Quality options endpoint is working');
      console.log('  Available formats:', response.data.formats?.length || 0);
      return true;
    } else {
      log.error(`Quality options endpoint returned status ${response.status}`);
      console.log('  Response:', response.data);
      return false;
    }
  } catch (error) {
    log.error(`Quality options endpoint failed: ${error.message}`);
    return false;
  }
}

async function testProbeAudioEndpoint() {
  log.test('Testing probe audio endpoint...');
  try {
    // This endpoint might need a file, so we'll just test if it responds
    const response = await makeRequest(`${BASE_URL}/api/probe-audio`, {
      method: 'POST',
      body: { filePath: '/nonexistent/test.mp3' }
    });
    
    // We expect this to fail gracefully, not crash
    if (response.status >= 400 && response.status < 500) {
      log.success('Probe audio endpoint is responding (expected error for test)');
      return true;
    } else if (response.status === 200) {
      log.success('Probe audio endpoint is working');
      return true;
    } else {
      log.error(`Probe audio endpoint returned unexpected status ${response.status}`);
      return false;
    }
  } catch (error) {
    log.error(`Probe audio endpoint failed: ${error.message}`);
    return false;
  }
}

async function testCORSHeaders() {
  log.test('Testing CORS headers...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/health`, {
      method: 'OPTIONS'
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers']
    };
    
    if (corsHeaders['access-control-allow-origin']) {
      log.success('CORS headers are configured');
      console.log('  Allow-Origin:', corsHeaders['access-control-allow-origin']);
      console.log('  Allow-Methods:', corsHeaders['access-control-allow-methods'] || 'Not set');
      return true;
    } else {
      log.warning('CORS headers might not be properly configured');
      return false;
    }
  } catch (error) {
    log.error(`CORS test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.magenta}=== VPS Backend API Testing ===${colors.reset}`);
  console.log(`Testing backend at: ${BASE_URL}`);
  console.log('');
  
  if (VPS_IP === 'YOUR_VPS_IP') {
    log.error('Please provide your VPS IP address as an argument:');
    console.log('  node test_api.js YOUR_VPS_IP');
    console.log('  Example: node test_api.js 123.456.789.012');
    process.exit(1);
  }
  
  const tests = [
    { name: 'Health Check', fn: testHealthEndpoint },
    { name: 'CORS Headers', fn: testCORSHeaders },
    { name: 'Video Info', fn: testVideoInfoEndpoint },
    { name: 'Quality Options', fn: testQualityOptionsEndpoint },
    { name: 'Probe Audio', fn: testProbeAudioEndpoint }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log.error(`Test '${test.name}' threw an error: ${error.message}`);
      failed++;
    }
    console.log(''); // Add spacing between tests
  }
  
  // Summary
  console.log(`${colors.magenta}=== Test Summary ===${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  if (failed === 0) {
    log.success('All tests passed! Your VPS backend is working correctly.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Update your .env.production file with your VPS IP');
    console.log('  2. Update vercel.json with your VPS IP');
    console.log('  3. Deploy your frontend to Vercel');
    console.log('  4. Test the full application');
  } else {
    log.error('Some tests failed. Please check your VPS backend configuration.');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Ensure your backend is running: pm2 status');
    console.log('  2. Check backend logs: pm2 logs downloader-backend');
    console.log('  3. Verify firewall allows port 3001: sudo ufw status');
    console.log('  4. Check if the process is listening: netstat -tlnp | grep 3001');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    log.error(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runAllTests, makeRequest };