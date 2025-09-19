import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

import ProxyRotationService from './ProxyRotationService.js';
import CookieManagementService from './CookieManagementService.js';
import RetryMechanismService from './RetryMechanismService.js';
import UserAgentRotationService from './UserAgentRotationService.js';
import CaptchaSolvingService from './CaptchaSolvingService.js';

class AdvancedDownloadService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Initialize all services
        this.proxyService = options.proxyService || new ProxyRotationService();
        this.cookieService = options.cookieService || new CookieManagementService();
        this.retryService = options.retryService || new RetryMechanismService();
        this.userAgentService = options.userAgentService || new UserAgentRotationService();
        this.captchaService = options.captchaService || new CaptchaSolvingService();
        this.errorService = options.errorService;
        
        // Download configuration
        this.config = {
            maxConcurrentDownloads: 3,
            defaultQuality: 'best[height<=1080]',
            outputTemplate: '%(title)s.%(ext)s',
            maxRetries: 5,
            enableProxyRotation: true,
            enableCookieRotation: true,
            enableUserAgentRotation: true,
            enableCaptchaSolving: true,
            adaptiveQuality: true,
            healthCheckInterval: 300000, // 5 minutes
            statsReportInterval: 600000, // 10 minutes
            timeout: 30000,
            ...options // Merge passed options
        };
        
        // Download queue and tracking
        this.downloadQueue = [];
        this.activeDownloads = new Map();
        this.downloadHistory = [];
        this.isProcessingQueue = false;
        
        // Performance metrics
        this.metrics = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            totalBytes: 0,
            averageSpeed: 0,
            averageTime: 0,
            errorPatterns: new Map()
        };
        
        // Start background processes
        this.startHealthMonitoring();
        this.startStatsReporting();
        
        console.log('🚀 Advanced Download Service initialized');
    }

    async downloadVideo(url, options = {}) {
        const downloadId = this.generateDownloadId();
        
        const downloadTask = {
            id: downloadId,
            url,
            options: {
                quality: options.quality || this.config.defaultQuality,
                format: options.format || 'mp4',
                outputPath: options.outputPath || './downloads',
                priority: options.priority || 'normal',
                retries: options.retries || this.config.maxRetries,
                ...options
            },
            status: 'queued',
            createdAt: Date.now(),
            attempts: 0,
            errors: []
        };
        
        console.log(`📥 Queuing download: ${downloadId}`);
        console.log(`   URL: ${url}`);
        console.log(`   Quality: ${downloadTask.options.quality}`);
        console.log(`   Priority: ${downloadTask.options.priority}`);
        
        // Add to queue based on priority
        if (downloadTask.options.priority === 'high') {
            this.downloadQueue.unshift(downloadTask);
        } else {
            this.downloadQueue.push(downloadTask);
        }
        
        // Start processing if not already running
        if (!this.isProcessingQueue) {
            this.processDownloadQueue();
        }
        
        return downloadId;
    }

    async processDownloadQueue() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        console.log('🔄 Starting download queue processing');
        
        while (this.downloadQueue.length > 0 && this.activeDownloads.size < this.config.maxConcurrentDownloads) {
            const task = this.downloadQueue.shift();
            
            if (task) {
                this.processDownloadTask(task);
            }
        }
        
        this.isProcessingQueue = false;
        
        // Check if queue is empty and no active downloads
        if (this.downloadQueue.length === 0 && this.activeDownloads.size === 0) {
            console.log('✅ All downloads completed');
            this.emit('queueEmpty');
        }
    }

    async processDownloadTask(task) {
        this.activeDownloads.set(task.id, task);
        task.status = 'processing';
        task.startedAt = Date.now();
        
        console.log(`🎬 Starting download: ${task.id}`);
        
        try {
            const result = await this.retryService.executeWithRetry(
                async (attempt, context) => {
                    return await this.executeDownload(task, attempt, context);
                },
                {
                    maxAttempts: task.options.retries,
                    context: { url: task.url, downloadId: task.id },
                    onRetry: async (attempt, delay, errorAnalysis) => {
                        console.log(`🔄 Retry ${attempt} for ${task.id} in ${delay}ms`);
                        task.attempts = attempt;
                        this.emit('downloadRetry', { task, attempt, delay, errorAnalysis });
                    },
                    onProxySwitch: async (errorAnalysis) => {
                        if (this.config.enableProxyRotation) {
                            await this.proxyService.switchProxy('Download failed, switching proxy');
                        }
                    },
                    onCookieRefresh: async (errorAnalysis) => {
                        if (this.config.enableCookieRotation) {
                            await this.cookieService.refreshCookies();
                        }
                    },
                    onCaptchaSolve: async (errorAnalysis) => {
                        if (this.config.enableCaptchaSolving) {
                            console.log('🤖 CAPTCHA detected, attempting to solve...');
                            // This would need to be integrated with the actual CAPTCHA challenge
                            // For now, we'll just log it
                        }
                    }
                }
            );
            
            task.status = 'completed';
            task.completedAt = Date.now();
            task.result = result;
            
            this.metrics.successfulDownloads++;
            this.updateMetrics(task, true);
            
            console.log(`✅ Download completed: ${task.id}`);
            this.emit('downloadComplete', { task, result });
            
        } catch (error) {
            task.status = 'failed';
            task.completedAt = Date.now();
            task.error = error.message;
            task.errors.push({
                message: error.message,
                timestamp: Date.now(),
                attempt: task.attempts
            });
            
            this.metrics.failedDownloads++;
            this.updateMetrics(task, false);
            this.recordErrorPattern(error.message);
            
            console.log(`❌ Download failed: ${task.id} - ${error.message}`);
            this.emit('downloadFailed', { task, error });
        } finally {
            this.activeDownloads.delete(task.id);
            this.downloadHistory.push(task);
            
            // Keep history limited
            if (this.downloadHistory.length > 1000) {
                this.downloadHistory = this.downloadHistory.slice(-500);
            }
            
            // Continue processing queue
            setTimeout(() => this.processDownloadQueue(), 1000);
        }
    }

    async executeDownload(task, attempt, context) {
        const startTime = Date.now();
        let downloadProcess = null;
        let timeoutId = null;
        let lastProgressTime = Date.now();
        
        try {
            // Prepare download environment
            const downloadConfig = await this.prepareDownloadConfig(task, attempt);
            
            console.log(`🔧 Download attempt ${attempt} configuration:`);
            console.log(`   Proxy: ${downloadConfig.proxy || 'None'}`);
            console.log(`   User-Agent: ${downloadConfig.userAgent.substring(0, 50)}...`);
            console.log(`   Cookies: ${downloadConfig.cookieFile}`);
            
            // Build yt-dlp command with optimizations
            const command = this.buildOptimizedYtDlpCommand(task, downloadConfig, attempt);
            
            console.log(`🚀 Executing: yt-dlp ${command.slice(0, 5).join(' ')}... (${command.length} args)`);
            
            return new Promise((resolve, reject) => {
                downloadProcess = spawn('yt-dlp', command, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, PYTHONUNBUFFERED: '1' }
                });
                
                let stdout = '';
                let stderr = '';
                let downloadProgress = null;
                let isStalled = false;
                
                // Set up timeout with stall detection
                const resetTimeout = () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        if (!isStalled && Date.now() - lastProgressTime > 120000) { // 2 minutes without progress
                            console.log('⚠️ Download appears stalled, terminating...');
                            isStalled = true;
                            downloadProcess.kill('SIGTERM');
                            setTimeout(() => {
                                if (downloadProcess && !downloadProcess.killed) {
                                    downloadProcess.kill('SIGKILL');
                                }
                            }, 5000);
                            reject(new Error('Download stalled - no progress for 2 minutes'));
                        }
                    }, 30000); // Check every 30 seconds
                };
                
                resetTimeout();
                
                downloadProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    lastProgressTime = Date.now();
                    resetTimeout();
                    
                    // Parse progress information with better regex
                    const progressMatch = output.match(/\[(\d+(?:\.\d+)?)%\].*?(?:at\s+)?(\d+(?:\.\d+)?\w*\/s)/i);
                    if (progressMatch) {
                        downloadProgress = {
                            percentage: parseFloat(progressMatch[1]),
                            speed: progressMatch[2],
                            timestamp: Date.now()
                        };
                        
                        this.emit('downloadProgress', {
                            taskId: task.id,
                            progress: downloadProgress
                        });
                    }
                    
                    // Check for specific error patterns in stdout
                    if (output.includes('ERROR:') || output.includes('WARNING:')) {
                        console.log(`📝 yt-dlp output: ${output.trim()}`);
                    }
                });
                
                downloadProcess.stderr.on('data', (data) => {
                    const errorOutput = data.toString();
                    stderr += errorOutput;
                    
                    // Log important errors immediately
                    if (errorOutput.includes('ERROR:') || errorOutput.includes('403') || errorOutput.includes('429')) {
                        console.log(`❌ yt-dlp error: ${errorOutput.trim()}`);
                    }
                });
                
                downloadProcess.on('close', (code, signal) => {
                    if (timeoutId) clearTimeout(timeoutId);
                    
                    const endTime = Date.now();
                    const duration = endTime - startTime;
                    
                    if (isStalled) {
                        return; // Already handled by timeout
                    }
                    
                    if (code === 0) {
                        // Success - extract file information
                        const result = {
                            duration,
                            output: stdout,
                            progress: downloadProgress,
                            config: downloadConfig,
                            attempt
                        };
                        
                        // Update service statistics
                        if (downloadConfig.proxy) {
                            this.proxyService.recordSuccess(downloadConfig.proxy);
                        }
                        
                        if (downloadConfig.cookieAccount) {
                            this.cookieService.recordSuccess(downloadConfig.cookieAccount);
                        }
                        
                        this.userAgentService.recordSuccess(downloadConfig.userAgent);
                        
                        console.log(`✅ Download completed in ${(duration / 1000).toFixed(1)}s`);
                        resolve(result);
                    } else {
                        // Failure - analyze error with better categorization
                        const errorMessage = stderr || stdout || `Process exited with code ${code}`;
                        const errorCategory = this.categorizeError(errorMessage, code);
                        
                        const error = new Error(`Download failed (${errorCategory}): ${errorMessage.slice(0, 200)}`);
                        error.category = errorCategory;
                        error.code = code;
                        error.signal = signal;
                        error.attempt = attempt;
                        
                        // Update service statistics with error details
                        if (downloadConfig.proxy) {
                            this.proxyService.recordFailure(downloadConfig.proxy, errorCategory);
                        }
                        
                        if (downloadConfig.cookieAccount) {
                            this.cookieService.recordFailure(downloadConfig.cookieAccount, errorCategory);
                        }
                        
                        this.userAgentService.recordFailure(downloadConfig.userAgent, errorCategory);
                        
                        console.log(`❌ Download failed after ${(duration / 1000).toFixed(1)}s: ${errorCategory}`);
                        reject(error);
                    }
                });
                
                downloadProcess.on('error', (error) => {
                    if (timeoutId) clearTimeout(timeoutId);
                    console.log(`💥 Process spawn error: ${error.message}`);
                    reject(new Error(`Failed to start download process: ${error.message}`));
                });
            });
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            throw new Error(`Download setup failed: ${error.message}`);
        }
    }
    
    buildOptimizedYtDlpCommand(task, config, attempt) {
        const command = [
            '--format', task.options.quality,
            '--output', path.join(task.options.outputPath, this.config.outputTemplate),
            '--no-playlist',
            '--socket-timeout', '30',
            '--retries', '3',
            '--fragment-retries', '5',
            '--retry-sleep', 'linear=1:5:10'
        ];
        
        // Add performance optimizations based on attempt
        if (attempt > 1) {
            command.push('--limit-rate', '1M'); // Limit rate on retries
            command.push('--sleep-interval', '2'); // Add delay between requests
        }
        
        // Add user agent
        if (config.userAgent) {
            command.push('--user-agent', config.userAgent);
        }
        
        // Add proxy
        if (config.proxy) {
            command.push('--proxy', config.proxy);
        }
        
        // Add cookies
        if (config.cookieFile) {
            command.push('--cookies', config.cookieFile);
        }
        
        // Add additional options
        if (task.options.subtitles) {
            command.push('--write-subs', '--sub-langs', 'en');
        }
        
        if (task.options.thumbnail) {
            command.push('--write-thumbnail');
        }
        
        if (task.options.metadata) {
            command.push('--write-info-json');
        }
        
        // Add adaptive quality fallback
        if (this.config.adaptiveQuality && attempt > 1) {
            const fallbackQualities = [
                'best[height<=720]',
                'best[height<=480]',
                'best[height<=360]',
                'worst'
            ];
            
            const fallbackIndex = Math.min(attempt - 2, fallbackQualities.length - 1);
            command[1] = fallbackQualities[fallbackIndex];
            
            console.log(`📉 Using fallback quality: ${command[1]}`);
        }
        
        // Add URL
        command.push(task.url);
        
        return command;
    }
    
    categorizeError(errorMessage, code) {
        const message = errorMessage.toLowerCase();
        
        if (message.includes('403') || message.includes('forbidden')) {
            return 'ACCESS_DENIED';
        }
        if (message.includes('429') || message.includes('rate limit')) {
            return 'RATE_LIMITED';
        }
        if (message.includes('404') || message.includes('not found')) {
            return 'NOT_FOUND';
        }
        if (message.includes('timeout') || message.includes('timed out')) {
            return 'TIMEOUT';
        }
        if (message.includes('network') || message.includes('connection')) {
            return 'NETWORK_ERROR';
        }
        if (message.includes('proxy')) {
            return 'PROXY_ERROR';
        }
        if (message.includes('cookie') || message.includes('authentication')) {
            return 'AUTH_ERROR';
        }
        if (code === 1) {
            return 'GENERAL_ERROR';
        }
        if (code === 2) {
            return 'USAGE_ERROR';
        }
        
        return 'UNKNOWN_ERROR';
    }

    async prepareDownloadConfig(task, attempt) {
        const config = {
            userAgent: null,
            proxy: null,
            cookieFile: null,
            cookieAccount: null
        };
        
        // Get user agent
        if (this.config.enableUserAgentRotation) {
            if (this.userAgentService.shouldRotate() || attempt > 1) {
                config.userAgent = this.userAgentService.getYouTubeOptimizedAgent();
            } else {
                config.userAgent = this.userAgentService.getNextUserAgent();
            }
        } else {
            config.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }
        
        // Get proxy
        if (this.config.enableProxyRotation) {
            config.proxy = await this.proxyService.getNextProxy();
        }
        
        // Get cookies
        if (this.config.enableCookieRotation) {
            const cookieAccount = this.cookieService.getNextCookieAccount();
            if (cookieAccount) {
                config.cookieFile = cookieAccount.path;
                config.cookieAccount = cookieAccount.name;
            }
        }
        
        return config;
    }

    buildYtDlpCommand(task, config) {
        const command = [
            '--format', task.options.quality,
            '--output', path.join(task.options.outputPath, this.config.outputTemplate),
            '--no-playlist'
        ];
        
        // Add user agent
        if (config.userAgent) {
            command.push('--user-agent', config.userAgent);
        }
        
        // Add proxy
        if (config.proxy) {
            command.push('--proxy', config.proxy);
        }
        
        // Add cookies
        if (config.cookieFile) {
            command.push('--cookies', config.cookieFile);
        }
        
        // Add additional options
        if (task.options.subtitles) {
            command.push('--write-subs', '--sub-langs', 'en');
        }
        
        if (task.options.thumbnail) {
            command.push('--write-thumbnail');
        }
        
        if (task.options.metadata) {
            command.push('--write-info-json');
        }
        
        // Add adaptive quality fallback
        if (this.config.adaptiveQuality && task.attempts > 1) {
            const fallbackQualities = [
                'best[height<=720]',
                'best[height<=480]',
                'best[height<=360]',
                'worst'
            ];
            
            const fallbackIndex = Math.min(task.attempts - 2, fallbackQualities.length - 1);
            command[1] = fallbackQualities[fallbackIndex];
            
            console.log(`📉 Using fallback quality: ${command[1]}`);
        }
        
        // Add URL
        command.push(task.url);
        
        return command;
    }

    updateMetrics(task, success) {
        this.metrics.totalDownloads++;
        
        if (task.completedAt && task.startedAt) {
            const duration = task.completedAt - task.startedAt;
            this.metrics.averageTime = 
                (this.metrics.averageTime * (this.metrics.totalDownloads - 1) + duration) / this.metrics.totalDownloads;
        }
        
        // Update other metrics based on task result
        if (success && task.result && task.result.progress) {
            // Extract speed information if available
            const speedMatch = task.result.progress.speed?.match(/(\d+\.\d+)(\w+)/);
            if (speedMatch) {
                const speed = parseFloat(speedMatch[1]);
                const unit = speedMatch[2];
                
                // Convert to bytes per second for consistency
                let bytesPerSecond = speed;
                if (unit.includes('K')) bytesPerSecond *= 1024;
                else if (unit.includes('M')) bytesPerSecond *= 1024 * 1024;
                else if (unit.includes('G')) bytesPerSecond *= 1024 * 1024 * 1024;
                
                this.metrics.averageSpeed = 
                    (this.metrics.averageSpeed * (this.metrics.successfulDownloads - 1) + bytesPerSecond) / this.metrics.successfulDownloads;
            }
        }
    }

    recordErrorPattern(errorMessage) {
        const pattern = this.extractErrorPattern(errorMessage);
        
        if (!this.metrics.errorPatterns.has(pattern)) {
            this.metrics.errorPatterns.set(pattern, 0);
        }
        
        this.metrics.errorPatterns.set(pattern, this.metrics.errorPatterns.get(pattern) + 1);
    }

    extractErrorPattern(errorMessage) {
        const patterns = [
            /rate.?limit/i,
            /captcha/i,
            /login.?required/i,
            /geo.?block/i,
            /network.?error/i,
            /timeout/i,
            /unavailable/i,
            /private/i
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(errorMessage)) {
                return pattern.source;
            }
        }
        
        return 'unknown';
    }

    startHealthMonitoring() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        console.log(`💓 Health monitoring started (${this.config.healthCheckInterval}ms interval)`);
    }

    startStatsReporting() {
        setInterval(() => {
            this.printStats();
        }, this.config.statsReportInterval);
        
        console.log(`📊 Stats reporting started (${this.config.statsReportInterval}ms interval)`);
    }

    async performHealthCheck() {
        console.log('💓 Performing health check...');
        
        // Check service health
        const proxyHealth = this.proxyService.getStats();
        const cookieHealth = this.cookieService.getStats();
        const retryHealth = this.retryService.getRetryStats();
        
        // Log warnings for poor performance
        if (proxyHealth.successRate < 0.5) {
            console.log('⚠️ Low proxy success rate detected');
        }
        
        if (cookieHealth.successRate < 0.7) {
            console.log('⚠️ Low cookie success rate detected');
        }
        
        if (retryHealth.successRate < 0.6) {
            console.log('⚠️ Low overall success rate detected');
        }
        
        // Auto-recovery actions
        if (this.activeDownloads.size === 0 && this.downloadQueue.length > 0) {
            console.log('🔄 Restarting stalled queue processing');
            this.processDownloadQueue();
        }
    }

    generateDownloadId() {
        return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getDownloadStatus(downloadId) {
        // Check active downloads
        if (this.activeDownloads.has(downloadId)) {
            return this.activeDownloads.get(downloadId);
        }
        
        // Check history
        const historyItem = this.downloadHistory.find(item => item.id === downloadId);
        if (historyItem) {
            return historyItem;
        }
        
        // Check queue
        const queueItem = this.downloadQueue.find(item => item.id === downloadId);
        if (queueItem) {
            return queueItem;
        }
        
        return null;
    }

    cancelDownload(downloadId) {
        // Remove from queue
        const queueIndex = this.downloadQueue.findIndex(item => item.id === downloadId);
        if (queueIndex !== -1) {
            this.downloadQueue.splice(queueIndex, 1);
            console.log(`❌ Download cancelled from queue: ${downloadId}`);
            return true;
        }
        
        // Cancel active download (this would need process management)
        if (this.activeDownloads.has(downloadId)) {
            console.log(`❌ Cancelling active download: ${downloadId}`);
            // Implementation would depend on process management
            return true;
        }
        
        return false;
    }

    async getVideoInfo(url, options = {}) {
        try {
            // Check cache first
            const cacheKey = `videoinfo_${Buffer.from(url).toString('base64')}`;
            if (this.videoInfoCache && this.videoInfoCache.has(cacheKey)) {
                const cached = this.videoInfoCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                    console.log('📋 Using cached video info');
                    return cached.data;
                }
            }
            
            // Use lightweight config for info extraction
            const config = await this.prepareLightweightConfig(options);
            const args = [
                '--dump-json',
                '--no-download',
                '--no-playlist',
                '--socket-timeout', '10',
                '--retries', '2',
                '--no-check-certificates',
                '--no-warnings',
                '--quiet'
            ];
            
            // Add essential config only
            if (config.userAgent) {
                args.push('--user-agent', config.userAgent);
            }
            
            // Only use proxy if explicitly requested or if previous attempts failed
            if (options.useProxy && config.proxy) {
                args.push('--proxy', config.proxy);
            }
            
            // Only use cookies if explicitly requested
            if (options.useCookies && config.cookieFile) {
                args.push('--cookies', config.cookieFile);
            }
            
            args.push(url);
            
            return new Promise((resolve, reject) => {
                const ytdlp = spawn('yt-dlp', args, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                let output = '';
                let errorOutput = '';
                
                ytdlp.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                ytdlp.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                ytdlp.on('close', (code) => {
                    if (code === 0 && output.trim()) {
                        try {
                            const videoInfo = JSON.parse(output.trim());
                            
                            // Cache the result
                            if (!this.videoInfoCache) {
                                this.videoInfoCache = new Map();
                            }
                            this.videoInfoCache.set(cacheKey, {
                                data: videoInfo,
                                timestamp: Date.now()
                            });
                            
                            // Clean old cache entries
                            if (this.videoInfoCache.size > 100) {
                                const oldestKey = this.videoInfoCache.keys().next().value;
                                this.videoInfoCache.delete(oldestKey);
                            }
                            
                            resolve(videoInfo);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse video info: ${parseError.message}`));
                        }
                    } else {
                        // If basic extraction fails, retry with enhanced config
                        if (!options.useProxy && !options.useCookies) {
                            console.log('🔄 Retrying video info with enhanced config');
                            resolve(this.getVideoInfo(url, { ...options, useProxy: true, useCookies: true }));
                        } else {
                            reject(new Error(`yt-dlp failed: ${errorOutput || 'Unknown error'}`));
                        }
                    }
                });
                
                // Shorter timeout for info extraction
                const timeout = setTimeout(() => {
                    ytdlp.kill('SIGTERM');
                    reject(new Error('Video info extraction timeout'));
                }, 15000); // Reduced from 30s to 15s
                
                ytdlp.on('close', () => {
                    clearTimeout(timeout);
                });
            });
        } catch (error) {
            throw new Error(`Failed to get video info: ${error.message}`);
        }
    }
    
    async prepareLightweightConfig(options = {}) {
        const config = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            proxy: null,
            cookieFile: null
        };
        
        // Only get proxy if requested
        if (options.useProxy && this.config.enableProxyRotation) {
            config.proxy = await this.proxyService.getNextProxy();
        }
        
        // Only get cookies if requested
        if (options.useCookies && this.config.enableCookieRotation) {
            const cookieAccount = this.cookieService.getNextCookieAccount();
            if (cookieAccount) {
                config.cookieFile = cookieAccount.path;
            }
        }
        
        return config;
    }

    getStats() {
        const successRate = this.metrics.totalDownloads > 0 ? 
            this.metrics.successfulDownloads / this.metrics.totalDownloads : 0;
        
        return {
            ...this.metrics,
            successRate,
            queueLength: this.downloadQueue.length,
            activeDownloads: this.activeDownloads.size,
            services: {
                proxy: this.proxyService.getStats(),
                cookies: this.cookieService.getStats(),
                retry: this.retryService.getRetryStats(),
                userAgent: this.userAgentService.getUsageStats(),
                captcha: this.captchaService.getStats()
            }
        };
    }

    printStats() {
        const stats = this.getStats();
        
        console.log('\n🚀 Advanced Download Service Statistics:');
        console.log(`  Total downloads: ${stats.totalDownloads}`);
        console.log(`  Successful: ${stats.successfulDownloads}`);
        console.log(`  Failed: ${stats.failedDownloads}`);
        console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`  Average time: ${(stats.averageTime / 1000).toFixed(1)}s`);
        console.log(`  Average speed: ${(stats.averageSpeed / 1024 / 1024).toFixed(2)} MB/s`);
        console.log(`  Queue length: ${stats.queueLength}`);
        console.log(`  Active downloads: ${stats.activeDownloads}`);
        
        // Show top error patterns
        if (stats.errorPatterns.size > 0) {
            console.log('\n❌ Top Error Patterns:');
            const sortedErrors = Array.from(stats.errorPatterns.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);
                
            sortedErrors.forEach(([pattern, count]) => {
                console.log(`  ${pattern}: ${count} occurrences`);
            });
        }
    }

    resetStats() {
        this.metrics = {
            totalDownloads: 0,
            successfulDownloads: 0,
            failedDownloads: 0,
            totalBytes: 0,
            averageSpeed: 0,
            averageTime: 0,
            errorPatterns: new Map()
        };
        
        // Reset service stats
        this.proxyService.resetStats();
        this.cookieService.resetStats();
        this.retryService.resetStats();
        this.userAgentService.resetStats();
        this.captchaService.resetStats();
        
        console.log('📊 All statistics reset');
    }
}

export default AdvancedDownloadService;