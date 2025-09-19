// Enhanced YouTube Downloader Server Integration
// This file provides integration points for the existing server.js

import EnhancedYouTubeDownloader from './EnhancedYouTubeDownloader.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ServerIntegration {
    constructor(options = {}) {
        this.options = {
            // Enhanced downloader configuration
            proxies: {
                enabled: process.env.PROXY_ENABLED === 'true',
                providers: ['webshare', 'brightdata'],
                rotationInterval: 300000, // 5 minutes
                ...options.proxies
            },
            cookies: {
                enabled: process.env.COOKIE_ENABLED === 'true',
                refreshInterval: 3600000, // 1 hour
                accounts: this.loadCookieAccounts(),
                ...options.cookies
            },
            captcha: {
                enabled: process.env.CAPTCHA_ENABLED === 'true',
                providers: {
                    '2captcha': { apiKey: process.env.TWOCAPTCHA_API_KEY },
                    'anticaptcha': { apiKey: process.env.ANTICAPTCHA_API_KEY }
                },
                ...options.captcha
            },
            download: {
                maxConcurrent: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 3,
                timeout: 300000, // 5 minutes
                tempDir: process.env.TEMP_DIR || '/tmp/downloader',
                ...options.download
            },
            health: {
                enabled: process.env.HEALTH_MONITORING === 'true',
                checkInterval: 30000, // 30 seconds
                recoveryEnabled: true,
                autoRestart: false, // Disabled for production safety
                ...options.health
            },
            error: {
                logLevel: process.env.LOG_LEVEL || 'info',
                logFile: './logs/enhanced-downloader.log',
                maxLogSize: 10485760, // 10MB
                maxLogFiles: 5,
                ...options.error
            }
        };
        
        this.downloader = null;
        this.isInitialized = false;
        this.stats = {
            requests: 0,
            successful: 0,
            failed: 0,
            startTime: Date.now()
        };
    }

    loadCookieAccounts() {
        try {
            const cookiesDir = path.join(__dirname, '../.cookies');
            if (!fs.existsSync(cookiesDir)) {
                return [];
            }
            
            const cookieFiles = fs.readdirSync(cookiesDir)
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(cookiesDir, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        return {
                            name: file.replace('.json', ''),
                            path: filePath,
                            cookies: JSON.parse(content)
                        };
                    } catch (error) {
                        console.warn(`⚠️ Failed to load cookie file ${file}:`, error.message);
                        return null;
                    }
                })
                .filter(account => account !== null);
            
            console.log(`🍪 Loaded ${cookieFiles.length} cookie accounts`);
            return cookieFiles;
        } catch (error) {
            console.warn('⚠️ Failed to load cookie accounts:', error.message);
            return [];
        }
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Server integration already initialized');
            return;
        }
        
        try {
            console.log('🚀 Initializing Enhanced YouTube Downloader integration...');
            
            // Create enhanced downloader instance
            this.downloader = new EnhancedYouTubeDownloader(this.options);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize the downloader
            await this.downloader.initialize();
            
            this.isInitialized = true;
            console.log('✅ Enhanced YouTube Downloader integration initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize enhanced downloader:', error.message);
            throw error;
        }
    }

    setupEventListeners() {
        this.downloader.on('download_started', (data) => {
            console.log(`🎬 Enhanced download started: ${data.url}`);
        });
        
        this.downloader.on('download_completed', (data) => {
            console.log(`✅ Enhanced download completed: ${data.filename}`);
            this.stats.successful++;
        });
        
        this.downloader.on('download_failed', (data) => {
            console.error(`❌ Enhanced download failed: ${data.error}`);
            this.stats.failed++;
        });
        
        this.downloader.on('critical_error', (data) => {
            console.error('🚨 Critical error in enhanced downloader:', data.message);
        });
        
        this.downloader.on('all_proxies_failed', () => {
            console.error('🚨 All proxies failed! Falling back to direct connection.');
        });
    }

    // Enhanced download endpoint handler
    async handleDownloadRequest(req, res) {
        this.stats.requests++;
        
        try {
            if (!this.isInitialized) {
                throw new Error('Enhanced downloader not initialized');
            }
            
            const { url, quality = 'high', format = 'best', outputPath } = req.body;
            
            if (!url) {
                return res.status(400).json({
                    success: false,
                    error: 'URL is required'
                });
            }
            
            console.log(`🎬 Enhanced download request: ${url}`);
            
            // Use enhanced downloader
            const result = await this.downloader.downloadVideo(url, {
                quality,
                format,
                outputPath
            });
            
            res.json({
                success: true,
                data: {
                    filename: result.filename,
                    path: result.path,
                    size: result.size,
                    duration: result.duration,
                    title: result.title,
                    format: result.format,
                    quality: result.quality
                },
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced download request failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Enhanced video info endpoint handler
    async handleVideoInfoRequest(req, res) {
        try {
            if (!this.isInitialized) {
                throw new Error('Enhanced downloader not initialized');
            }
            
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({
                    success: false,
                    error: 'URL is required'
                });
            }
            
            console.log(`ℹ️ Enhanced video info request: ${url}`);
            
            const info = await this.downloader.getVideoInfo(url);
            const formats = await this.downloader.getAvailableFormats(url);
            
            res.json({
                success: true,
                data: {
                    ...info,
                    availableFormats: formats
                },
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced video info request failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Enhanced health check endpoint handler
    async handleHealthCheckRequest(req, res) {
        try {
            const health = this.downloader ? this.downloader.getHealthStatus() : {
                status: 'not_initialized',
                message: 'Enhanced downloader not initialized'
            };
            
            const stats = this.downloader ? this.downloader.getStats() : {};
            
            res.json({
                success: true,
                data: {
                    health,
                    stats: {
                        ...stats,
                        integration: this.stats
                    },
                    enhanced: true,
                    initialized: this.isInitialized
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced health check failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Enhanced bulk download endpoint handler
    async handleBulkDownloadRequest(req, res) {
        try {
            if (!this.isInitialized) {
                throw new Error('Enhanced downloader not initialized');
            }
            
            const { urls, quality = 'high', format = 'best' } = req.body;
            
            if (!urls || !Array.isArray(urls) || urls.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'URLs array is required'
                });
            }
            
            console.log(`📦 Enhanced bulk download request: ${urls.length} videos`);
            
            const results = await this.downloader.downloadMultiple(urls, {
                quality,
                format
            });
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            res.json({
                success: true,
                data: {
                    results,
                    summary: {
                        total: urls.length,
                        successful,
                        failed,
                        successRate: (successful / urls.length) * 100
                    }
                },
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced bulk download request failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Test connection endpoint handler
    async handleTestConnectionRequest(req, res) {
        try {
            if (!this.isInitialized) {
                throw new Error('Enhanced downloader not initialized');
            }
            
            const testResult = await this.downloader.testConnection();
            
            res.json({
                success: testResult.success,
                data: testResult,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced connection test failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Service refresh endpoint handler
    async handleRefreshServicesRequest(req, res) {
        try {
            if (!this.isInitialized) {
                throw new Error('Enhanced downloader not initialized');
            }
            
            await this.downloader.refreshServices();
            
            res.json({
                success: true,
                message: 'Services refreshed successfully',
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced service refresh failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Get configuration endpoint handler
    handleGetConfigurationRequest(req, res) {
        try {
            const config = this.downloader ? this.downloader.getConfiguration() : {
                initialized: false,
                message: 'Enhanced downloader not initialized'
            };
            
            res.json({
                success: true,
                data: {
                    ...config,
                    integration: {
                        initialized: this.isInitialized,
                        stats: this.stats
                    }
                },
                enhanced: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Enhanced configuration request failed:', error.message);
            
            res.status(500).json({
                success: false,
                error: error.message,
                enhanced: true,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Fallback to original downloader if enhanced fails
    async fallbackDownload(url, options, originalDownloadFunction) {
        console.log('🔄 Falling back to original downloader...');
        
        try {
            return await originalDownloadFunction(url, options);
        } catch (error) {
            console.error('❌ Fallback download also failed:', error.message);
            throw error;
        }
    }

    // Check if enhanced downloader should be used
    shouldUseEnhanced() {
        return this.isInitialized && this.downloader;
    }

    // Get integration stats
    getIntegrationStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            successRate: this.stats.requests > 0 ? 
                (this.stats.successful / this.stats.requests) * 100 : 0,
            enhanced: this.shouldUseEnhanced()
        };
    }

    async shutdown() {
        console.log('🛑 Shutting down server integration...');
        
        try {
            if (this.downloader) {
                await this.downloader.shutdown();
            }
            
            this.isInitialized = false;
            console.log('✅ Server integration shut down successfully');
            
        } catch (error) {
            console.error('❌ Error during integration shutdown:', error.message);
            throw error;
        }
    }
}

export default ServerIntegration;