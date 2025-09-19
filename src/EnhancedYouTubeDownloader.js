import ProxyRotationService from './services/ProxyRotationService.js';
import CookieManagementService from './services/CookieManagementService.js';
import RetryMechanismService from './services/RetryMechanismService.js';
import UserAgentRotationService from './services/UserAgentRotationService.js';
import CaptchaSolvingService from './services/CaptchaSolvingService.js';
import AdvancedDownloadService from './services/AdvancedDownloadService.js';
import FormatSelectionService from './services/FormatSelectionService.js';
import ErrorHandlingService from './services/ErrorHandlingService.js';
import HealthMonitoringService from './services/HealthMonitoringService.js';
import { EventEmitter } from 'events';

class EnhancedYouTubeDownloader extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Proxy configuration
            proxies: {
                enabled: true,
                providers: ['webshare', 'brightdata', 'oxylabs'],
                rotationInterval: 300000, // 5 minutes
                healthCheckInterval: 60000, // 1 minute
                maxFailures: 3,
                ...options.proxies
            },
            
            // Cookie configuration
            cookies: {
                enabled: true,
                refreshInterval: 3600000, // 1 hour
                maxAge: 86400000, // 24 hours
                accounts: options.cookies?.accounts || [],
                ...options.cookies
            },
            
            // Retry configuration
            retry: {
                maxAttempts: 5,
                baseDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
                jitter: true,
                ...options.retry
            },
            
            // CAPTCHA configuration
            captcha: {
                enabled: false, // Disabled by default
                providers: {
                    '2captcha': { apiKey: process.env.TWOCAPTCHA_API_KEY },
                    'anticaptcha': { apiKey: process.env.ANTICAPTCHA_API_KEY },
                    'capmonster': { apiKey: process.env.CAPMONSTER_API_KEY }
                },
                timeout: 120000, // 2 minutes
                ...options.captcha
            },
            
            // Download configuration
            download: {
                maxConcurrent: 3,
                timeout: 300000, // 5 minutes
                retryDelay: 5000,
                tempDir: '/tmp/downloader',
                cleanupInterval: 3600000, // 1 hour
                ...options.download
            },
            
            // Format selection configuration
            format: {
                defaultQuality: 'high',
                adaptiveBitrate: true,
                fallbackEnabled: true,
                networkSpeedTest: true,
                ...options.format
            },
            
            // Health monitoring configuration
            health: {
                enabled: true,
                checkInterval: 30000, // 30 seconds
                recoveryEnabled: true,
                autoRestart: false, // Disabled for production safety
                ...options.health
            },
            
            // Error handling configuration
            error: {
                logLevel: 'info',
                logFile: './logs/downloader.log',
                maxLogSize: 10485760, // 10MB
                maxLogFiles: 5,
                alerting: {
                    enabled: false,
                    webhook: null,
                    errorThreshold: 10,
                    timeWindow: 300000 // 5 minutes
                },
                ...options.error
            }
        };
        
        this.services = {};
        this.isInitialized = false;
        this.stats = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            totalBytes: 0,
            averageSpeed: 0,
            uptime: Date.now()
        };
        
        console.log('🚀 Enhanced YouTube Downloader initializing...');
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Enhanced YouTube Downloader already initialized');
            return;
        }
        
        try {
            console.log('🔧 Initializing services...');
            
            // Initialize error handling first
            this.services.error = new ErrorHandlingService(this.options.error);
            
            // Initialize user agent rotation
            this.services.userAgent = new UserAgentRotationService();
            
            // Initialize proxy service
            if (this.options.proxies.enabled) {
                this.services.proxy = new ProxyRotationService(this.options.proxies);
            }
            
            // Initialize cookie management
            if (this.options.cookies.enabled) {
                this.services.cookie = new CookieManagementService(this.options.cookies);
            }
            
            // Initialize CAPTCHA solving
            if (this.options.captcha.enabled) {
                this.services.captcha = new CaptchaSolvingService(this.options.captcha);
            }
            
            // Initialize retry mechanism
            this.services.retry = new RetryMechanismService({
                ...this.options.retry,
                proxyService: this.services.proxy,
                cookieService: this.services.cookie,
                captchaService: this.services.captcha,
                errorService: this.services.error
            });
            
            // Initialize format selection
            this.services.format = new FormatSelectionService(this.options.format);
            
            // Initialize download service
            this.services.download = new AdvancedDownloadService({
                ...this.options.download,
                proxyService: this.services.proxy,
                cookieService: this.services.cookie,
                retryService: this.services.retry,
                userAgentService: this.services.userAgent,
                captchaService: this.services.captcha,
                formatService: this.services.format,
                errorService: this.services.error
            });
            // Download service initialized in constructor
            
            // Initialize health monitoring
            if (this.options.health.enabled) {
                this.services.health = new HealthMonitoringService(this.options.health);
                
                // Register all services for health monitoring
                this.services.health.registerService('proxy', this.services.proxy);
                this.services.health.registerService('cookie', this.services.cookie);
                this.services.health.registerService('download', this.services.download);
                this.services.health.registerService('captcha', this.services.captcha);
                this.services.health.registerService('format', this.services.format);
                this.services.health.registerService('error', this.services.error);
                
                this.services.health.startMonitoring();
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Enhanced YouTube Downloader initialized successfully');
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced YouTube Downloader:', error.message);
            if (this.services.error) {
                this.services.error.error(error.message, { context: 'initialization', error: error.stack });
            }
            throw error;
        }
    }

    setupEventListeners() {
        // Download service events
        if (this.services.download && typeof this.services.download.on === 'function') {
            this.services.download.on('download_started', (data) => {
                this.stats.totalDownloads++;
                this.emit('download_started', data);
            });
            
            this.services.download.on('download_completed', (data) => {
                this.stats.successfulDownloads++;
                this.stats.totalBytes += data.size || 0;
                this.updateAverageSpeed(data.speed);
                this.emit('download_completed', data);
            });
            
            this.services.download.on('download_failed', (data) => {
                this.stats.failedDownloads++;
                this.emit('download_failed', data);
            });
            
            this.services.download.on('download_progress', (data) => {
                this.emit('download_progress', data);
            });
        }
        
        // Health monitoring events
        if (this.services.health && typeof this.services.health.on === 'function') {
            this.services.health.on('health_check_completed', (data) => {
                this.emit('health_check', data);
            });
            
            this.services.health.on('service_restart_requested', async (data) => {
                console.log('🔄 Service restart requested by health monitor');
                this.emit('restart_requested', data);
            });
        }
        
        // Error service events
        if (this.services.error && typeof this.services.error.on === 'function') {
            this.services.error.on('critical_error', (data) => {
                console.error('🚨 Critical error detected:', data.message);
                this.emit('critical_error', data);
            });
            
            this.services.error.on('error_threshold_exceeded', (data) => {
                console.warn('⚠️ Error threshold exceeded:', data);
                this.emit('error_threshold_exceeded', data);
            });
        }
        
        // Proxy service events
        if (this.services.proxy && typeof this.services.proxy.on === 'function') {
            this.services.proxy.on('proxy_failed', (data) => {
                console.warn('🔴 Proxy failed:', data.proxy);
            });
            
            this.services.proxy.on('all_proxies_failed', () => {
                console.error('🚨 All proxies failed!');
                this.emit('all_proxies_failed');
            });
        }
        
        // Cookie service events
        if (this.services.cookie && typeof this.services.cookie.on === 'function') {
            this.services.cookie.on('cookies_refreshed', (data) => {
                console.log('🍪 Cookies refreshed:', data.account);
            });
            
            this.services.cookie.on('cookie_expired', (data) => {
                console.warn('⚠️ Cookie expired:', data.account);
            });
        }
    }

    updateAverageSpeed(speed) {
        if (this.stats.successfulDownloads === 1) {
            this.stats.averageSpeed = speed;
        } else {
            // Exponential moving average
            const alpha = 0.1;
            this.stats.averageSpeed = alpha * speed + (1 - alpha) * this.stats.averageSpeed;
        }
    }

    async downloadVideo(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Enhanced YouTube Downloader not initialized. Call initialize() first.');
        }
        
        try {
            console.log(`🎬 Starting enhanced download: ${url}`);
            
            // Merge options with defaults
            const downloadOptions = {
                quality: this.options.format.defaultQuality,
                format: 'best',
                outputPath: this.options.download.tempDir,
                ...options
            };
            
            // Use the advanced download service
            const result = await this.services.download.downloadVideo(url, downloadOptions);
            
            console.log(`✅ Enhanced download completed: ${result.filename}`);
            return result;
            
        } catch (error) {
            console.error(`❌ Enhanced download failed: ${error.message}`);
            
            if (this.services.error) {
                this.services.error.error(error.message, { context: 'download', url, options, error: error.stack });
            }
            
            throw error;
        }
    }

    async downloadMultiple(urls, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Enhanced YouTube Downloader not initialized. Call initialize() first.');
        }
        
        try {
            console.log(`📦 Starting bulk download: ${urls.length} videos`);
            
            const results = await this.services.download.downloadMultiple(urls, options);
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`📊 Bulk download completed: ${successful} successful, ${failed} failed`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ Bulk download failed: ${error.message}`);
            
            if (this.services.error) {
                this.services.error.error(error.message, { context: 'bulk_download', urls, options, error: error.stack });
            }
            
            throw error;
        }
    }

    async getVideoInfo(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Enhanced YouTube Downloader not initialized. Call initialize() first.');
        }
        
        try {
            console.log(`ℹ️ Getting video info: ${url}`);
            
            const info = await this.services.download.getVideoInfo(url, options);
            
            console.log(`✅ Video info retrieved: ${info.title}`);
            return info;
            
        } catch (error) {
            console.error(`❌ Failed to get video info: ${error.message}`);
            
            if (this.services.error) {
                this.services.error.error(error.message, { context: 'video_info', url, options, error: error.stack });
            }
            
            throw error;
        }
    }

    async getAvailableFormats(url, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Enhanced YouTube Downloader not initialized. Call initialize() first.');
        }
        
        try {
            const formats = await this.services.format.getAvailableFormats(url, options);
            return formats;
        } catch (error) {
            if (this.services.error) {
                this.services.error.error(error.message, { context: 'format_detection', url, options, error: error.stack });
            }
            throw error;
        }
    }

    getStats() {
        const baseStats = {
            ...this.stats,
            uptime: Date.now() - this.stats.uptime,
            successRate: this.stats.totalDownloads > 0 ? 
                (this.stats.successfulDownloads / this.stats.totalDownloads) * 100 : 0
        };
        
        // Add service-specific stats
        const serviceStats = {};
        
        if (this.services.download) {
            serviceStats.download = this.services.download.getStats();
        }
        
        if (this.services.proxy) {
            serviceStats.proxy = this.services.proxy.getStats();
        }
        
        if (this.services.cookie) {
            serviceStats.cookie = this.services.cookie.getStats();
        }
        
        if (this.services.retry) {
            serviceStats.retry = this.services.retry.getStats();
        }
        
        if (this.services.captcha) {
            serviceStats.captcha = this.services.captcha.getStats();
        }
        
        if (this.services.format) {
            serviceStats.format = this.services.format.getFormatStats();
        }
        
        if (this.services.error) {
            serviceStats.error = this.services.error.getMetrics();
        }
        
        return {
            ...baseStats,
            services: serviceStats
        };
    }

    getHealthStatus() {
        if (!this.services.health) {
            return { status: 'unknown', message: 'Health monitoring disabled' };
        }
        
        return this.services.health.getHealthStatus();
    }

    async testConnection(url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ') {
        try {
            console.log('🧪 Testing connection...');
            
            const info = await this.getVideoInfo(url);
            
            console.log('✅ Connection test successful');
            return {
                success: true,
                message: 'Connection test successful',
                videoTitle: info.title,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return {
                success: false,
                message: `Connection test failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    async refreshServices() {
        console.log('🔄 Refreshing services...');
        
        const refreshPromises = [];
        
        if (this.services.proxy && typeof this.services.proxy.refreshProxies === 'function') {
            refreshPromises.push(this.services.proxy.refreshProxies());
        }
        
        if (this.services.cookie && typeof this.services.cookie.refreshAll === 'function') {
            refreshPromises.push(this.services.cookie.refreshAll());
        }
        
        if (this.services.userAgent && typeof this.services.userAgent.refreshUserAgents === 'function') {
            refreshPromises.push(this.services.userAgent.refreshUserAgents());
        }
        
        try {
            await Promise.allSettled(refreshPromises);
            console.log('✅ Services refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh some services:', error.message);
        }
    }

    async shutdown() {
        console.log('🛑 Shutting down Enhanced YouTube Downloader...');
        
        try {
            // Stop health monitoring
            if (this.services.health) {
                this.services.health.stopMonitoring();
            }
            
            // Stop download service
            if (this.services.download && typeof this.services.download.shutdown === 'function') {
                await this.services.download.shutdown();
            }
            
            // Close error service
            if (this.services.error && typeof this.services.error.close === 'function') {
                await this.services.error.close();
            }
            
            this.isInitialized = false;
            
            console.log('✅ Enhanced YouTube Downloader shut down successfully');
            this.emit('shutdown');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
            throw error;
        }
    }

    // Utility methods for external integration
    getService(name) {
        return this.services[name] || null;
    }

    isServiceAvailable(name) {
        return this.services[name] && typeof this.services[name] === 'object';
    }

    getConfiguration() {
        return {
            ...this.options,
            initialized: this.isInitialized,
            availableServices: Object.keys(this.services)
        };
    }
}

export default EnhancedYouTubeDownloader;