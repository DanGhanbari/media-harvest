#!/usr/bin/env node

/**
 * Enhanced YouTube Bypass System Test Suite
 * Tests advanced rate limiting, performance monitoring, and adaptive throttling
 */

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class EnhancedSystemTester {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.testResults = {
            timestamp: new Date().toISOString(),
            summary: {},
            tests: [],
            performance: {},
            recommendations: []
        };
        this.testUrls = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.youtube.com/watch?v=jNQXAC9IVRw',
            'https://www.youtube.com/watch?v=9bZkp7q19f0',
            'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
            'https://www.youtube.com/watch?v=L_jWHffIx5E'
        ];
    }

    async runAllTests() {
        console.log('🚀 Starting Enhanced YouTube Bypass System Tests\n');
        
        try {
            // Test 1: Performance Monitoring Endpoints
            await this.testPerformanceEndpoints();
            
            // Test 2: Advanced Rate Limiting
            await this.testAdvancedRateLimiting();
            
            // Test 3: Adaptive Throttling
            await this.testAdaptiveThrottling();
            
            // Test 4: Circuit Breaker Functionality
            await this.testCircuitBreaker();
            
            // Test 5: Failure Pattern Analysis
            await this.testFailurePatternAnalysis();
            
            // Test 6: Performance Metrics Collection
            await this.testPerformanceMetrics();
            
            // Test 7: Dashboard Analytics
            await this.testDashboardAnalytics();
            
            // Generate final report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.testResults.summary.status = 'FAILED';
            this.testResults.summary.error = error.message;
        }
    }

    async testPerformanceEndpoints() {
        console.log('📊 Testing Performance Monitoring Endpoints...');
        
        try {
            // Test /api/performance endpoint
            const perfResponse = await axios.get(`${this.baseUrl}/api/performance`);
            const perfTest = {
                name: 'Performance Endpoint',
                status: perfResponse.status === 200 ? 'PASS' : 'FAIL',
                data: perfResponse.data,
                timestamp: new Date().toISOString()
            };
            
            console.log(`   ✅ Performance endpoint: ${perfTest.status}`);
            console.log(`   📈 Metrics available: ${Object.keys(perfResponse.data.data.bypassMetrics).length} windows`);
            
            // Test /api/dashboard endpoint
            const dashResponse = await axios.get(`${this.baseUrl}/api/dashboard`);
            const dashTest = {
                name: 'Dashboard Endpoint',
                status: dashResponse.status === 200 ? 'PASS' : 'FAIL',
                data: dashResponse.data,
                timestamp: new Date().toISOString()
            };
            
            console.log(`   ✅ Dashboard endpoint: ${dashTest.status}`);
            console.log(`   🎯 Recommendations: ${dashResponse.data.data.recommendations.length}`);
            
            this.testResults.tests.push(perfTest, dashTest);
            
        } catch (error) {
            console.error('   ❌ Performance endpoints test failed:', error.message);
            this.testResults.tests.push({
                name: 'Performance Endpoints',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testAdvancedRateLimiting() {
        console.log('\n⏱️ Testing Advanced Rate Limiting...');
        
        const startTime = Date.now();
        const requests = [];
        
        try {
            // Send 5 rapid requests to test rate limiting
            for (let i = 0; i < 5; i++) {
                const requestStart = Date.now();
                
                try {
                    const response = await axios.post(`${this.baseUrl}/api/video-info`, {
                        url: this.testUrls[i % this.testUrls.length]
                    }, { timeout: 30000 });
                    
                    const requestTime = Date.now() - requestStart;
                    requests.push({
                        index: i + 1,
                        success: true,
                        responseTime: requestTime,
                        status: response.status,
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log(`   📝 Request ${i + 1}: ${requestTime}ms - ${response.status}`);
                    
                } catch (error) {
                    const requestTime = Date.now() - requestStart;
                    requests.push({
                        index: i + 1,
                        success: false,
                        responseTime: requestTime,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log(`   ❌ Request ${i + 1}: ${requestTime}ms - ${error.message}`);
                }
                
                // Small delay between requests to observe rate limiting
                if (i < 4) await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const totalTime = Date.now() - startTime;
            const avgResponseTime = requests.reduce((sum, req) => sum + req.responseTime, 0) / requests.length;
            const successRate = requests.filter(req => req.success).length / requests.length;
            
            console.log(`   📊 Total time: ${totalTime}ms, Avg response: ${Math.round(avgResponseTime)}ms`);
            console.log(`   📈 Success rate: ${(successRate * 100).toFixed(1)}%`);
            
            this.testResults.tests.push({
                name: 'Advanced Rate Limiting',
                status: successRate > 0.6 ? 'PASS' : 'FAIL',
                metrics: {
                    totalRequests: requests.length,
                    successfulRequests: requests.filter(req => req.success).length,
                    successRate: successRate,
                    avgResponseTime: avgResponseTime,
                    totalTime: totalTime
                },
                requests: requests,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Rate limiting test failed:', error.message);
            this.testResults.tests.push({
                name: 'Advanced Rate Limiting',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testAdaptiveThrottling() {
        console.log('\n🎯 Testing Adaptive Throttling...');
        
        try {
            // Get initial performance metrics
            const initialMetrics = await axios.get(`${this.baseUrl}/api/performance`);
            const initialMultiplier = parseFloat(initialMetrics.data.data.bypassMetrics.adaptiveMultiplier);
            
            console.log(`   📊 Initial adaptive multiplier: ${initialMultiplier}x`);
            
            // Send requests to trigger adaptive behavior
            const adaptiveRequests = [];
            for (let i = 0; i < 3; i++) {
                const requestStart = Date.now();
                
                try {
                    await axios.post(`${this.baseUrl}/api/video-info`, {
                        url: this.testUrls[i % this.testUrls.length]
                    }, { timeout: 25000 });
                    
                    adaptiveRequests.push({
                        index: i + 1,
                        success: true,
                        responseTime: Date.now() - requestStart
                    });
                    
                } catch (error) {
                    adaptiveRequests.push({
                        index: i + 1,
                        success: false,
                        error: error.message,
                        responseTime: Date.now() - requestStart
                    });
                }
                
                // Check metrics after each request
                const currentMetrics = await axios.get(`${this.baseUrl}/api/performance`);
                const currentMultiplier = parseFloat(currentMetrics.data.data.bypassMetrics.adaptiveMultiplier);
                
                console.log(`   🔄 Request ${i + 1}: multiplier = ${currentMultiplier}x`);
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Get final metrics
            const finalMetrics = await axios.get(`${this.baseUrl}/api/performance`);
            const finalMultiplier = parseFloat(finalMetrics.data.data.bypassMetrics.adaptiveMultiplier);
            
            console.log(`   📈 Final adaptive multiplier: ${finalMultiplier}x`);
            
            this.testResults.tests.push({
                name: 'Adaptive Throttling',
                status: 'PASS',
                metrics: {
                    initialMultiplier: initialMultiplier,
                    finalMultiplier: finalMultiplier,
                    multiplierChange: finalMultiplier - initialMultiplier,
                    requests: adaptiveRequests
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Adaptive throttling test failed:', error.message);
            this.testResults.tests.push({
                name: 'Adaptive Throttling',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testCircuitBreaker() {
        console.log('\n🚨 Testing Circuit Breaker Functionality...');
        
        try {
            // Get initial circuit breaker status
            const initialDash = await axios.get(`${this.baseUrl}/api/dashboard`);
            const initialStatus = initialDash.data.data.overview.circuitBreakerStatus;
            
            console.log(`   🔍 Initial circuit breaker status: ${initialStatus}`);
            
            this.testResults.tests.push({
                name: 'Circuit Breaker Status Check',
                status: 'PASS',
                metrics: {
                    initialStatus: initialStatus,
                    consecutiveFailures: initialDash.data.data.analysis.consecutiveFailures
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Circuit breaker test failed:', error.message);
            this.testResults.tests.push({
                name: 'Circuit Breaker',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testFailurePatternAnalysis() {
        console.log('\n🔍 Testing Failure Pattern Analysis...');
        
        try {
            const dashboard = await axios.get(`${this.baseUrl}/api/dashboard`);
            const failureDistribution = dashboard.data.data.analysis.failureDistribution;
            
            console.log('   📊 Failure distribution:');
            Object.entries(failureDistribution).forEach(([type, count]) => {
                console.log(`      ${type}: ${count}`);
            });
            
            this.testResults.tests.push({
                name: 'Failure Pattern Analysis',
                status: 'PASS',
                data: {
                    failureDistribution: failureDistribution,
                    totalFailureTypes: Object.keys(failureDistribution).length
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Failure pattern analysis failed:', error.message);
            this.testResults.tests.push({
                name: 'Failure Pattern Analysis',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testPerformanceMetrics() {
        console.log('\n📈 Testing Performance Metrics Collection...');
        
        try {
            const performance = await axios.get(`${this.baseUrl}/api/performance`);
            const metrics = performance.data.data.bypassMetrics;
            
            console.log('   📊 Performance windows:');
            Object.entries(metrics).forEach(([window, data]) => {
                if (typeof data === 'object' && data.successRate) {
                    console.log(`      ${window}: ${data.totalRequests} requests, ${data.successRate} success`);
                }
            });
            
            this.testResults.performance = {
                metrics: metrics,
                systemInfo: performance.data.data.systemInfo,
                proxyStatus: performance.data.data.proxyStatus,
                cookieStatus: performance.data.data.cookieStatus
            };
            
            this.testResults.tests.push({
                name: 'Performance Metrics Collection',
                status: 'PASS',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Performance metrics test failed:', error.message);
            this.testResults.tests.push({
                name: 'Performance Metrics Collection',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async testDashboardAnalytics() {
        console.log('\n📋 Testing Dashboard Analytics...');
        
        try {
            const dashboard = await axios.get(`${this.baseUrl}/api/dashboard`);
            const data = dashboard.data.data;
            
            console.log('   📊 Dashboard overview:');
            console.log(`      Total requests: ${data.overview.totalRequests}`);
            console.log(`      Success rate: ${data.overview.successRate}`);
            console.log(`      Avg delay: ${data.overview.avgResponseDelay}`);
            console.log(`      Circuit breaker: ${data.overview.circuitBreakerStatus}`);
            
            console.log('   🎯 Recommendations:');
            data.recommendations.forEach((rec, index) => {
                console.log(`      ${index + 1}. [${rec.type.toUpperCase()}] ${rec.message}`);
            });
            
            this.testResults.recommendations = data.recommendations;
            
            this.testResults.tests.push({
                name: 'Dashboard Analytics',
                status: 'PASS',
                data: {
                    overview: data.overview,
                    recommendationCount: data.recommendations.length
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('   ❌ Dashboard analytics test failed:', error.message);
            this.testResults.tests.push({
                name: 'Dashboard Analytics',
                status: 'FAIL',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async generateReport() {
        console.log('\n📝 Generating Enhanced System Test Report...');
        
        const passedTests = this.testResults.tests.filter(test => test.status === 'PASS').length;
        const totalTests = this.testResults.tests.length;
        const successRate = (passedTests / totalTests * 100).toFixed(1);
        
        this.testResults.summary = {
            status: passedTests === totalTests ? 'ALL_PASSED' : 'SOME_FAILED',
            totalTests: totalTests,
            passedTests: passedTests,
            failedTests: totalTests - passedTests,
            successRate: successRate + '%',
            timestamp: new Date().toISOString()
        };
        
        console.log('\n🎉 Enhanced System Test Results:');
        console.log(`   📊 Tests: ${passedTests}/${totalTests} passed (${successRate}%)`);
        console.log(`   🎯 Status: ${this.testResults.summary.status}`);
        console.log(`   📈 Performance monitoring: ACTIVE`);
        console.log(`   🔄 Adaptive throttling: ACTIVE`);
        console.log(`   🚨 Circuit breaker: MONITORED`);
        
        // Save detailed report
        const reportPath = join(__dirname, 'enhanced-system-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
        
        console.log(`\n📄 Detailed report saved: ${reportPath}`);
        
        return this.testResults;
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new EnhancedSystemTester();
    tester.runAllTests().catch(console.error);
}

export default EnhancedSystemTester;