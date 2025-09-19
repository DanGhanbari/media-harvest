#!/usr/bin/env node

// Enhanced YouTube Downloader Deployment Script
// This script helps deploy and test the enhanced downloader system

import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import EnhancedYouTubeDownloader from './src/EnhancedYouTubeDownloader.js';
import ServerIntegration from './src/server-integration.js';

class DeploymentManager {
    constructor() {
        this.config = {
            testUrls: [
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll for testing
                'https://www.youtube.com/watch?v=9bZkp7q19f0', // Gangnam Style
                'https://www.youtube.com/watch?v=kJQP7kiw5Fk'  // Despacito
            ],
            vpsConfig: {
                host: '57.129.63.234',
                user: 'daniel',
                remotePath: '/home/daniel/downloader',
                pm2Name: 'downloader-backend'
            },
            localTestPort: 3001
        };
        
        this.testResults = {
            services: {},
            downloads: {},
            performance: {},
            errors: []
        };
    }

    async runDeployment() {
        console.log('🚀 Enhanced YouTube Downloader Deployment Manager');
        console.log('=' .repeat(60));
        
        try {
            // Step 1: Validate environment
            await this.validateEnvironment();
            
            // Step 2: Test enhanced services locally
            await this.testEnhancedServices();
            
            // Step 3: Run integration tests
            await this.runIntegrationTests();
            
            // Step 4: Performance benchmarks
            await this.runPerformanceBenchmarks();
            
            // Step 5: Generate deployment report
            this.generateDeploymentReport();
            
            // Step 6: Deploy to VPS (optional)
            const shouldDeploy = process.argv.includes('--deploy');
            if (shouldDeploy) {
                await this.deployToVPS();
            } else {
                console.log('\n📋 To deploy to VPS, run: node deploy-enhanced.js --deploy');
            }
            
            console.log('\n✅ Deployment process completed successfully!');
            
        } catch (error) {
            console.error('\n❌ Deployment failed:', error.message);
            process.exit(1);
        }
    }

    async validateEnvironment() {
        console.log('\n🔍 Validating environment...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        console.log(`   Node.js version: ${nodeVersion}`);
        
        if (parseInt(nodeVersion.slice(1)) < 14) {
            throw new Error('Node.js 14 or higher is required');
        }
        
        // Check required directories
        const requiredDirs = [
            './src/services',
            './logs',
            './temp'
        ];
        
        for (const dir of requiredDirs) {
            if (!fs.existsSync(dir)) {
                console.log(`   Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        
        // Check environment variables
        const envVars = {
            'PROXY_ENABLED': process.env.PROXY_ENABLED || 'false',
            'COOKIE_ENABLED': process.env.COOKIE_ENABLED || 'false',
            'CAPTCHA_ENABLED': process.env.CAPTCHA_ENABLED || 'false',
            'HEALTH_MONITORING': process.env.HEALTH_MONITORING || 'true',
            'LOG_LEVEL': process.env.LOG_LEVEL || 'info'
        };
        
        console.log('   Environment variables:');
        for (const [key, value] of Object.entries(envVars)) {
            console.log(`     ${key}: ${value}`);
        }
        
        // Check yt-dlp installation
        try {
            await this.execCommand('yt-dlp --version');
            console.log('   ✅ yt-dlp is installed');
        } catch (error) {
            console.warn('   ⚠️ yt-dlp not found, some features may not work');
        }
        
        console.log('✅ Environment validation completed');
    }

    async testEnhancedServices() {
        console.log('\n🧪 Testing enhanced services...');
        
        try {
            // Initialize enhanced downloader
            const downloader = new EnhancedYouTubeDownloader({
                proxies: { enabled: false }, // Disable for testing
                cookies: { enabled: false },
                captcha: { enabled: false },
                health: { enabled: true, checkInterval: 10000 },
                error: { logLevel: 'debug' }
            });
            
            console.log('   Initializing enhanced downloader...');
            await downloader.initialize();
            
            // Test service availability
            const services = ['proxy', 'cookie', 'download', 'format', 'error', 'health'];
            for (const serviceName of services) {
                const available = downloader.isServiceAvailable(serviceName);
                this.testResults.services[serviceName] = available;
                console.log(`   ${serviceName}: ${available ? '✅' : '❌'}`);
            }
            
            // Test connection
            console.log('   Testing connection...');
            const connectionTest = await downloader.testConnection();
            this.testResults.services.connection = connectionTest.success;
            console.log(`   Connection test: ${connectionTest.success ? '✅' : '❌'}`);
            
            if (!connectionTest.success) {
                console.warn(`   Connection test failed: ${connectionTest.message}`);
            }
            
            // Get initial stats
            const stats = downloader.getStats();
            console.log(`   Initial stats: ${JSON.stringify(stats, null, 2)}`);
            
            await downloader.shutdown();
            console.log('✅ Enhanced services test completed');
            
        } catch (error) {
            console.error('❌ Enhanced services test failed:', error.message);
            this.testResults.errors.push({
                test: 'enhanced_services',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async runIntegrationTests() {
        console.log('\n🔗 Running integration tests...');
        
        try {
            // Test server integration
            const integration = new ServerIntegration({
                proxies: { enabled: false },
                cookies: { enabled: false },
                captcha: { enabled: false },
                health: { enabled: true }
            });
            
            console.log('   Initializing server integration...');
            await integration.initialize();
            
            // Test video info retrieval
            console.log('   Testing video info retrieval...');
            const testUrl = this.config.testUrls[0];
            
            try {
                const mockReq = { query: { url: testUrl } };
                const mockRes = {
                    json: (data) => {
                        this.testResults.downloads.videoInfo = data.success;
                        console.log(`   Video info test: ${data.success ? '✅' : '❌'}`);
                        if (!data.success) {
                            console.warn(`   Error: ${data.error}`);
                        }
                    },
                    status: (code) => ({ json: (data) => {
                        this.testResults.downloads.videoInfo = false;
                        console.log(`   Video info test: ❌ (${code})`);
                        console.warn(`   Error: ${data.error}`);
                    }})
                };
                
                await integration.handleVideoInfoRequest(mockReq, mockRes);
            } catch (error) {
                console.warn(`   Video info test failed: ${error.message}`);
                this.testResults.downloads.videoInfo = false;
            }
            
            // Test health check
            console.log('   Testing health check...');
            try {
                const mockReq = {};
                const mockRes = {
                    json: (data) => {
                        this.testResults.services.healthCheck = data.success;
                        console.log(`   Health check test: ${data.success ? '✅' : '❌'}`);
                    },
                    status: (code) => ({ json: (data) => {
                        this.testResults.services.healthCheck = false;
                        console.log(`   Health check test: ❌ (${code})`);
                    }})
                };
                
                await integration.handleHealthCheckRequest(mockReq, mockRes);
            } catch (error) {
                console.warn(`   Health check test failed: ${error.message}`);
                this.testResults.services.healthCheck = false;
            }
            
            await integration.shutdown();
            console.log('✅ Integration tests completed');
            
        } catch (error) {
            console.error('❌ Integration tests failed:', error.message);
            this.testResults.errors.push({
                test: 'integration',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async runPerformanceBenchmarks() {
        console.log('\n⚡ Running performance benchmarks...');
        
        try {
            const startTime = Date.now();
            
            // Memory usage before
            const memBefore = process.memoryUsage();
            
            // Initialize downloader
            const downloader = new EnhancedYouTubeDownloader({
                proxies: { enabled: false },
                cookies: { enabled: false },
                captcha: { enabled: false },
                health: { enabled: true, checkInterval: 5000 }
            });
            
            await downloader.initialize();
            
            // Memory usage after initialization
            const memAfter = process.memoryUsage();
            
            // Test video info retrieval speed
            const infoStartTime = Date.now();
            try {
                await downloader.getVideoInfo(this.config.testUrls[0]);
                const infoEndTime = Date.now();
                this.testResults.performance.videoInfoTime = infoEndTime - infoStartTime;
                console.log(`   Video info retrieval: ${this.testResults.performance.videoInfoTime}ms`);
            } catch (error) {
                console.warn(`   Video info benchmark failed: ${error.message}`);
                this.testResults.performance.videoInfoTime = -1;
            }
            
            // Test format detection speed
            const formatStartTime = Date.now();
            try {
                await downloader.getAvailableFormats(this.config.testUrls[0]);
                const formatEndTime = Date.now();
                this.testResults.performance.formatDetectionTime = formatEndTime - formatStartTime;
                console.log(`   Format detection: ${this.testResults.performance.formatDetectionTime}ms`);
            } catch (error) {
                console.warn(`   Format detection benchmark failed: ${error.message}`);
                this.testResults.performance.formatDetectionTime = -1;
            }
            
            // Calculate memory usage
            this.testResults.performance.memoryUsage = {
                before: memBefore,
                after: memAfter,
                increase: {
                    rss: memAfter.rss - memBefore.rss,
                    heapUsed: memAfter.heapUsed - memBefore.heapUsed,
                    heapTotal: memAfter.heapTotal - memBefore.heapTotal
                }
            };
            
            console.log(`   Memory increase: ${Math.round(this.testResults.performance.memoryUsage.increase.rss / 1024 / 1024)}MB RSS`);
            
            // Total initialization time
            const totalTime = Date.now() - startTime;
            this.testResults.performance.initializationTime = totalTime;
            console.log(`   Total initialization time: ${totalTime}ms`);
            
            await downloader.shutdown();
            console.log('✅ Performance benchmarks completed');
            
        } catch (error) {
            console.error('❌ Performance benchmarks failed:', error.message);
            this.testResults.errors.push({
                test: 'performance',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    generateDeploymentReport() {
        console.log('\n📊 Deployment Report');
        console.log('=' .repeat(60));
        
        // Services status
        console.log('\n🔧 Services Status:');
        for (const [service, status] of Object.entries(this.testResults.services)) {
            console.log(`   ${service}: ${status ? '✅' : '❌'}`);
        }
        
        // Download tests
        console.log('\n📥 Download Tests:');
        for (const [test, status] of Object.entries(this.testResults.downloads)) {
            console.log(`   ${test}: ${status ? '✅' : '❌'}`);
        }
        
        // Performance metrics
        console.log('\n⚡ Performance Metrics:');
        if (this.testResults.performance.initializationTime) {
            console.log(`   Initialization: ${this.testResults.performance.initializationTime}ms`);
        }
        if (this.testResults.performance.videoInfoTime && this.testResults.performance.videoInfoTime > 0) {
            console.log(`   Video Info: ${this.testResults.performance.videoInfoTime}ms`);
        }
        if (this.testResults.performance.formatDetectionTime && this.testResults.performance.formatDetectionTime > 0) {
            console.log(`   Format Detection: ${this.testResults.performance.formatDetectionTime}ms`);
        }
        if (this.testResults.performance.memoryUsage) {
            const memIncrease = Math.round(this.testResults.performance.memoryUsage.increase.rss / 1024 / 1024);
            console.log(`   Memory Usage: +${memIncrease}MB`);
        }
        
        // Errors
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            for (const error of this.testResults.errors) {
                console.log(`   ${error.test}: ${error.error}`);
            }
        }
        
        // Overall assessment
        const totalTests = Object.keys(this.testResults.services).length + Object.keys(this.testResults.downloads).length;
        const passedTests = Object.values(this.testResults.services).filter(Boolean).length + 
                           Object.values(this.testResults.downloads).filter(Boolean).length;
        const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        
        console.log('\n📈 Overall Assessment:');
        console.log(`   Tests Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
        console.log(`   Errors: ${this.testResults.errors.length}`);
        
        if (successRate >= 80) {
            console.log('   Status: ✅ Ready for deployment');
        } else if (successRate >= 60) {
            console.log('   Status: ⚠️ Deployment with caution');
        } else {
            console.log('   Status: ❌ Not ready for deployment');
        }
        
        // Save report to file
        const reportPath = './deployment-report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            results: this.testResults,
            assessment: {
                totalTests,
                passedTests,
                successRate,
                errors: this.testResults.errors.length,
                ready: successRate >= 80
            }
        }, null, 2));
        
        console.log(`\n📄 Report saved to: ${reportPath}`);
    }

    async deployToVPS() {
        console.log('\n🚀 Deploying to VPS...');
        
        try {
            const { host, user, remotePath, pm2Name } = this.config.vpsConfig;
            
            // Upload files
            console.log('   Uploading files...');
            await this.execCommand(`rsync -avz --exclude node_modules --exclude .git --exclude logs --exclude temp . ${user}@${host}:${remotePath}/`);
            
            // Install dependencies
            console.log('   Installing dependencies...');
            await this.execCommand(`ssh ${user}@${host} "cd ${remotePath} && npm install"`);
            
            // Restart PM2 process
            console.log('   Restarting PM2 process...');
            await this.execCommand(`ssh ${user}@${host} "cd ${remotePath} && pm2 restart ${pm2Name} || pm2 start server.js --name ${pm2Name}"`);
            
            // Check deployment status
            console.log('   Checking deployment status...');
            await this.sleep(5000); // Wait for restart
            
            try {
                const result = await this.execCommand(`ssh ${user}@${host} "pm2 status ${pm2Name}"`);
                console.log('   PM2 Status:');
                console.log(result.stdout);
            } catch (error) {
                console.warn('   Could not get PM2 status:', error.message);
            }
            
            console.log('✅ VPS deployment completed');
            
        } catch (error) {
            console.error('❌ VPS deployment failed:', error.message);
            throw error;
        }
    }

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run deployment if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new DeploymentManager();
    manager.runDeployment().catch(error => {
        console.error('Deployment failed:', error.message);
        process.exit(1);
    });
}

export default DeploymentManager;