#!/usr/bin/env node

/**
 * Comprehensive test script for the enhanced YouTube bypass system
 * Tests all implemented features: proxy rotation, cookie management, rate limiting, etc.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api/video-info`;

// Test videos
const TEST_VIDEOS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll
  'https://www.youtube.com/watch?v=jNQXAC9IVRw', // Me at the zoo
  'https://www.youtube.com/watch?v=9bZkp7q19f0', // Gangnam Style
];

class BypassSystemTester {
  constructor() {
    this.results = {
      basicFunctionality: [],
      rateLimit: [],
      cookieRotation: [],
      proxyRotation: [],
      circuitBreaker: [],
      errors: []
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testBasicFunctionality() {
    console.log('\n🧪 Testing Basic Functionality...');
    
    for (const url of TEST_VIDEOS) {
      try {
        const start = Date.now();
        const response = await axios.post(API_URL, { url }, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        });
        const duration = Date.now() - start;
        
        const result = {
          url,
          success: response.status === 200,
          title: response.data?.title || 'Unknown',
          duration: `${duration}ms`,
          strategies: response.data?.strategies_used || [],
          timestamp: new Date().toISOString()
        };
        
        this.results.basicFunctionality.push(result);
        console.log(`✅ ${result.title} (${result.duration})`);
        
      } catch (error) {
        const result = {
          url,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        this.results.basicFunctionality.push(result);
        console.log(`❌ Failed: ${error.message}`);
      }
      
      await this.delay(1000); // Small delay between tests
    }
  }

  async testRateLimiting() {
    console.log('\n⏱️ Testing Rate Limiting & Circuit Breaker...');
    
    const testUrl = TEST_VIDEOS[0];
    const requests = [];
    
    // Send 15 rapid requests to trigger rate limiting
    for (let i = 0; i < 15; i++) {
      requests.push(this.makeTimedRequest(testUrl, i + 1));
    }
    
    const results = await Promise.allSettled(requests);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.success) successCount++;
        else if (data.rateLimited) rateLimitedCount++;
        else errorCount++;
        
        this.results.rateLimit.push({
          requestNumber: index + 1,
          ...data
        });
      } else {
        errorCount++;
        this.results.rateLimit.push({
          requestNumber: index + 1,
          success: false,
          error: result.reason.message
        });
      }
    });
    
    console.log(`📊 Results: ${successCount} success, ${rateLimitedCount} rate-limited, ${errorCount} errors`);
  }

  async makeTimedRequest(url, requestNumber) {
    const start = Date.now();
    try {
      const response = await axios.post(API_URL, { url }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const duration = Date.now() - start;
      return {
        success: true,
        duration: `${duration}ms`,
        rateLimited: duration > 5000, // Assume rate limited if > 5s
        title: response.data?.title || 'Unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        success: false,
        duration: `${duration}ms`,
        error: error.message,
        rateLimited: error.code === 'ECONNABORTED' || duration > 5000,
        timestamp: new Date().toISOString()
      };
    }
  }

  async testCookieRotation() {
    console.log('\n🍪 Testing Cookie Rotation...');
    
    const cookiesDir = path.join(__dirname, '.cookies');
    
    // Check initial state
    const initialFiles = this.getCookieFiles(cookiesDir);
    console.log(`Initial cookie files: ${initialFiles.length}`);
    
    // Make requests that might trigger cookie rotation
    for (let i = 0; i < 5; i++) {
      try {
        await axios.post(API_URL, { url: TEST_VIDEOS[i % TEST_VIDEOS.length] }, {
          timeout: 15000
        });
        console.log(`Request ${i + 1} completed`);
      } catch (error) {
        console.log(`Request ${i + 1} failed: ${error.message}`);
      }
      
      await this.delay(2000);
    }
    
    // Check final state
    const finalFiles = this.getCookieFiles(cookiesDir);
    console.log(`Final cookie files: ${finalFiles.length}`);
    
    this.results.cookieRotation = {
      initialFiles: initialFiles.length,
      finalFiles: finalFiles.length,
      filesCreated: finalFiles.length - initialFiles.length,
      files: finalFiles
    };
  }

  getCookieFiles(dir) {
    try {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter(file => 
        file.endsWith('.txt') || file.includes('cookies')
      );
    } catch (error) {
      return [];
    }
  }

  async testProxyRotation() {
    console.log('\n🌐 Testing Proxy Rotation (simulated)...');
    
    // Since we don't have real proxies, we'll test the configuration detection
    const envVars = [
      'US_PROXY_1', 'US_PROXY_2', 'US_PROXY_3',
      'EU_PROXY_1', 'EU_PROXY_2', 'EU_PROXY_3',
      'APAC_PROXY_1', 'APAC_PROXY_2', 'APAC_PROXY_3'
    ];
    
    const configuredProxies = envVars.filter(varName => process.env[varName]);
    
    this.results.proxyRotation = {
      configuredProxies: configuredProxies.length,
      totalPossible: envVars.length,
      proxies: configuredProxies
    };
    
    console.log(`Configured proxies: ${configuredProxies.length}/${envVars.length}`);
  }

  async generateReport() {
    console.log('\n📋 Generating Test Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        basicTests: this.results.basicFunctionality.length,
        basicSuccesses: this.results.basicFunctionality.filter(r => r.success).length,
        rateLimitTests: this.results.rateLimit.length,
        cookieRotationActive: this.results.cookieRotation.filesCreated > 0,
        proxyConfigured: this.results.proxyRotation.configuredProxies > 0
      },
      details: this.results
    };
    
    // Save report
    const reportPath = path.join(__dirname, 'bypass-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Test Report Summary:`);
    console.log(`Basic functionality: ${report.summary.basicSuccesses}/${report.summary.basicTests} successful`);
    console.log(`Rate limiting: ${report.summary.rateLimitTests} requests tested`);
    console.log(`Cookie rotation: ${report.summary.cookieRotationActive ? 'Active' : 'Not triggered'}`);
    console.log(`Proxy configuration: ${report.summary.proxyConfigured ? 'Configured' : 'Not configured'}`);
    console.log(`\nFull report saved to: ${reportPath}`);
    
    return report;
  }

  async runAllTests() {
    console.log('🚀 Starting Enhanced YouTube Bypass System Tests...');
    console.log('=' .repeat(60));
    
    try {
      await this.testBasicFunctionality();
      await this.testRateLimiting();
      await this.testCookieRotation();
      await this.testProxyRotation();
      
      const report = await this.generateReport();
      
      console.log('\n✅ All tests completed!');
      return report;
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      this.results.errors.push({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BypassSystemTester();
  tester.runAllTests()
    .then(report => {
      console.log('\n🎉 Testing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Testing failed:', error.message);
      process.exit(1);
    });
}

export default BypassSystemTester;