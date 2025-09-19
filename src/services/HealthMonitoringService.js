import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';

class HealthMonitoringService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            checkInterval: options.checkInterval || 30000, // 30 seconds
            recoveryEnabled: options.recoveryEnabled !== false,
            autoRestart: options.autoRestart !== false,
            maxRestartAttempts: options.maxRestartAttempts || 3,
            restartCooldown: options.restartCooldown || 300000, // 5 minutes
            healthThresholds: {
                cpuUsage: 90, // 90%
                memoryUsage: 85, // 85%
                diskUsage: 90, // 90%
                errorRate: 0.2, // 20%
                responseTime: 30000, // 30 seconds
                consecutiveFailures: 5,
                proxyFailureRate: 0.5, // 50%
                cookieFailureRate: 0.3, // 30%
                ...options.healthThresholds
            },
            services: {
                proxy: true,
                cookie: true,
                download: true,
                captcha: true,
                format: true,
                ...options.services
            }
        };
        
        this.healthStatus = {
            overall: 'healthy',
            lastCheck: null,
            services: {
                system: { status: 'healthy', lastCheck: null, issues: [] },
                proxy: { status: 'healthy', lastCheck: null, issues: [] },
                cookie: { status: 'healthy', lastCheck: null, issues: [] },
                download: { status: 'healthy', lastCheck: null, issues: [] },
                captcha: { status: 'healthy', lastCheck: null, issues: [] },
                format: { status: 'healthy', lastCheck: null, issues: [] }
            },
            metrics: {
                uptime: 0,
                totalChecks: 0,
                healthyChecks: 0,
                lastIncident: null,
                recoveryActions: 0
            }
        };
        
        this.recoveryActions = {
            'high_cpu_usage': [
                { action: 'reduce_concurrency', priority: 1 },
                { action: 'restart_workers', priority: 2 },
                { action: 'scale_down', priority: 3 }
            ],
            'high_memory_usage': [
                { action: 'garbage_collect', priority: 1 },
                { action: 'clear_caches', priority: 2 },
                { action: 'restart_service', priority: 3 }
            ],
            'high_disk_usage': [
                { action: 'cleanup_temp_files', priority: 1 },
                { action: 'rotate_logs', priority: 2 },
                { action: 'clear_downloads', priority: 3 }
            ],
            'high_error_rate': [
                { action: 'switch_proxy_pool', priority: 1 },
                { action: 'refresh_cookies', priority: 2 },
                { action: 'reduce_request_rate', priority: 3 }
            ],
            'slow_response_time': [
                { action: 'optimize_requests', priority: 1 },
                { action: 'switch_proxy_pool', priority: 2 },
                { action: 'reduce_concurrency', priority: 3 }
            ],
            'proxy_failures': [
                { action: 'test_proxy_health', priority: 1 },
                { action: 'refresh_proxy_list', priority: 2 },
                { action: 'switch_proxy_provider', priority: 3 }
            ],
            'cookie_failures': [
                { action: 'refresh_cookies', priority: 1 },
                { action: 'switch_account_pool', priority: 2 },
                { action: 'solve_captcha', priority: 3 }
            ],
            'download_failures': [
                { action: 'switch_format', priority: 1 },
                { action: 'retry_with_fallback', priority: 2 },
                { action: 'clear_download_cache', priority: 3 }
            ]
        };
        
        this.serviceReferences = {
            proxy: null,
            cookie: null,
            download: null,
            captcha: null,
            format: null,
            error: null
        };
        
        this.restartHistory = [];
        this.recoveryHistory = [];
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        console.log('🏥 Health Monitoring Service initialized');
        console.log(`   Check interval: ${this.options.checkInterval / 1000}s`);
        console.log(`   Recovery enabled: ${this.options.recoveryEnabled}`);
        console.log(`   Auto restart: ${this.options.autoRestart}`);
    }

    registerService(name, serviceInstance) {
        if (this.serviceReferences.hasOwnProperty(name)) {
            this.serviceReferences[name] = serviceInstance;
            console.log(`🔗 Registered ${name} service for health monitoring`);
        } else {
            console.warn(`⚠️ Unknown service type: ${name}`);
        }
    }

    startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ Health monitoring is already running');
            return;
        }
        
        this.isMonitoring = true;
        this.healthStatus.metrics.uptime = Date.now();
        
        console.log('🏥 Starting health monitoring...');
        
        // Initial health check
        this.performHealthCheck();
        
        // Set up periodic health checks
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.options.checkInterval);
        
        // Set up graceful shutdown
        process.on('SIGINT', () => this.stopMonitoring());
        process.on('SIGTERM', () => this.stopMonitoring());
        
        this.emit('monitoring_started');
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        console.log('🛑 Stopping health monitoring...');
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.emit('monitoring_stopped');
    }

    async performHealthCheck() {
        const checkStartTime = Date.now();
        
        try {
            console.log('🔍 Performing health check...');
            
            // Check system health
            await this.checkSystemHealth();
            
            // Check service health
            if (this.options.services.proxy) await this.checkProxyHealth();
            if (this.options.services.cookie) await this.checkCookieHealth();
            if (this.options.services.download) await this.checkDownloadHealth();
            if (this.options.services.captcha) await this.checkCaptchaHealth();
            if (this.options.services.format) await this.checkFormatHealth();
            
            // Update overall health status
            this.updateOverallHealth();
            
            // Check for recovery needs
            await this.checkRecoveryNeeds();
            
            // Update metrics
            this.healthStatus.metrics.totalChecks++;
            if (this.healthStatus.overall === 'healthy') {
                this.healthStatus.metrics.healthyChecks++;
            }
            
            this.healthStatus.lastCheck = Date.now();
            
            const checkDuration = Date.now() - checkStartTime;
            console.log(`✅ Health check completed in ${checkDuration}ms - Status: ${this.healthStatus.overall}`);
            
            this.emit('health_check_completed', {
                status: this.healthStatus.overall,
                duration: checkDuration,
                timestamp: this.healthStatus.lastCheck
            });
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.emit('health_check_failed', error);
        }
    }

    async checkSystemHealth() {
        const issues = [];
        
        try {
            // CPU Usage
            const cpuUsage = await this.getCpuUsage();
            if (cpuUsage > this.options.healthThresholds.cpuUsage) {
                issues.push({
                    type: 'high_cpu_usage',
                    severity: 'warning',
                    value: cpuUsage,
                    threshold: this.options.healthThresholds.cpuUsage,
                    message: `CPU usage is ${cpuUsage.toFixed(1)}% (threshold: ${this.options.healthThresholds.cpuUsage}%)`
                });
            }
            
            // Memory Usage
            const memoryUsage = this.getMemoryUsage();
            if (memoryUsage > this.options.healthThresholds.memoryUsage) {
                issues.push({
                    type: 'high_memory_usage',
                    severity: 'warning',
                    value: memoryUsage,
                    threshold: this.options.healthThresholds.memoryUsage,
                    message: `Memory usage is ${memoryUsage.toFixed(1)}% (threshold: ${this.options.healthThresholds.memoryUsage}%)`
                });
            }
            
            // Disk Usage
            const diskUsage = await this.getDiskUsage();
            if (diskUsage > this.options.healthThresholds.diskUsage) {
                issues.push({
                    type: 'high_disk_usage',
                    severity: 'warning',
                    value: diskUsage,
                    threshold: this.options.healthThresholds.diskUsage,
                    message: `Disk usage is ${diskUsage.toFixed(1)}% (threshold: ${this.options.healthThresholds.diskUsage}%)`
                });
            }
            
            this.healthStatus.services.system = {
                status: issues.length === 0 ? 'healthy' : 'warning',
                lastCheck: Date.now(),
                issues,
                metrics: {
                    cpuUsage,
                    memoryUsage,
                    diskUsage,
                    uptime: process.uptime()
                }
            };
            
        } catch (error) {
            this.healthStatus.services.system = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'system_check_failed',
                    severity: 'error',
                    message: `System health check failed: ${error.message}`
                }]
            };
        }
    }

    async checkProxyHealth() {
        const issues = [];
        
        try {
            const proxyService = this.serviceReferences.proxy;
            if (!proxyService) {
                issues.push({
                    type: 'service_not_registered',
                    severity: 'warning',
                    message: 'Proxy service not registered for health monitoring'
                });
            } else {
                const stats = proxyService.getStats();
                const failureRate = stats.totalAttempts > 0 ? stats.failures / stats.totalAttempts : 0;
                
                if (failureRate > this.options.healthThresholds.proxyFailureRate) {
                    issues.push({
                        type: 'proxy_failures',
                        severity: 'warning',
                        value: failureRate,
                        threshold: this.options.healthThresholds.proxyFailureRate,
                        message: `Proxy failure rate is ${(failureRate * 100).toFixed(1)}% (threshold: ${(this.options.healthThresholds.proxyFailureRate * 100)}%)`
                    });
                }
                
                if (stats.activeProxies === 0) {
                    issues.push({
                        type: 'no_active_proxies',
                        severity: 'critical',
                        message: 'No active proxies available'
                    });
                }
            }
            
            this.healthStatus.services.proxy = {
                status: this.getServiceStatus(issues),
                lastCheck: Date.now(),
                issues
            };
            
        } catch (error) {
            this.healthStatus.services.proxy = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'proxy_check_failed',
                    severity: 'error',
                    message: `Proxy health check failed: ${error.message}`
                }]
            };
        }
    }

    async checkCookieHealth() {
        const issues = [];
        
        try {
            const cookieService = this.serviceReferences.cookie;
            if (!cookieService) {
                issues.push({
                    type: 'service_not_registered',
                    severity: 'warning',
                    message: 'Cookie service not registered for health monitoring'
                });
            } else {
                const stats = cookieService.getStats();
                const failureRate = stats.totalAttempts > 0 ? stats.failures / stats.totalAttempts : 0;
                
                if (failureRate > this.options.healthThresholds.cookieFailureRate) {
                    issues.push({
                        type: 'cookie_failures',
                        severity: 'warning',
                        value: failureRate,
                        threshold: this.options.healthThresholds.cookieFailureRate,
                        message: `Cookie failure rate is ${(failureRate * 100).toFixed(1)}% (threshold: ${(this.options.healthThresholds.cookieFailureRate * 100)}%)`
                    });
                }
                
                if (stats.activeCookies === 0) {
                    issues.push({
                        type: 'no_active_cookies',
                        severity: 'critical',
                        message: 'No active cookies available'
                    });
                }
            }
            
            this.healthStatus.services.cookie = {
                status: this.getServiceStatus(issues),
                lastCheck: Date.now(),
                issues
            };
            
        } catch (error) {
            this.healthStatus.services.cookie = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'cookie_check_failed',
                    severity: 'error',
                    message: `Cookie health check failed: ${error.message}`
                }]
            };
        }
    }

    async checkDownloadHealth() {
        const issues = [];
        
        try {
            const downloadService = this.serviceReferences.download;
            const errorService = this.serviceReferences.error;
            
            if (!downloadService) {
                issues.push({
                    type: 'service_not_registered',
                    severity: 'warning',
                    message: 'Download service not registered for health monitoring'
                });
            } else {
                const stats = downloadService.getStats();
                const errorRate = stats.totalDownloads > 0 ? stats.failedDownloads / stats.totalDownloads : 0;
                
                if (errorRate > this.options.healthThresholds.errorRate) {
                    issues.push({
                        type: 'high_error_rate',
                        severity: 'warning',
                        value: errorRate,
                        threshold: this.options.healthThresholds.errorRate,
                        message: `Download error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${(this.options.healthThresholds.errorRate * 100)}%)`
                    });
                }
                
                if (stats.averageResponseTime > this.options.healthThresholds.responseTime) {
                    issues.push({
                        type: 'slow_response_time',
                        severity: 'warning',
                        value: stats.averageResponseTime,
                        threshold: this.options.healthThresholds.responseTime,
                        message: `Average response time is ${(stats.averageResponseTime / 1000).toFixed(1)}s (threshold: ${(this.options.healthThresholds.responseTime / 1000)}s)`
                    });
                }
            }
            
            if (errorService) {
                const errorMetrics = errorService.getMetrics();
                if (errorMetrics.consecutiveFailures > this.options.healthThresholds.consecutiveFailures) {
                    issues.push({
                        type: 'consecutive_failures',
                        severity: 'critical',
                        value: errorMetrics.consecutiveFailures,
                        threshold: this.options.healthThresholds.consecutiveFailures,
                        message: `${errorMetrics.consecutiveFailures} consecutive failures detected`
                    });
                }
            }
            
            this.healthStatus.services.download = {
                status: this.getServiceStatus(issues),
                lastCheck: Date.now(),
                issues
            };
            
        } catch (error) {
            this.healthStatus.services.download = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'download_check_failed',
                    severity: 'error',
                    message: `Download health check failed: ${error.message}`
                }]
            };
        }
    }

    async checkCaptchaHealth() {
        const issues = [];
        
        try {
            const captchaService = this.serviceReferences.captcha;
            if (!captchaService) {
                issues.push({
                    type: 'service_not_registered',
                    severity: 'info',
                    message: 'CAPTCHA service not registered for health monitoring'
                });
            } else {
                const stats = captchaService.getStats();
                
                if (stats.averageTime > 60000) { // 1 minute
                    issues.push({
                        type: 'slow_captcha_solving',
                        severity: 'warning',
                        value: stats.averageTime,
                        message: `CAPTCHA solving is slow: ${(stats.averageTime / 1000).toFixed(1)}s average`
                    });
                }
                
                if (stats.successRate < 0.8) { // 80%
                    issues.push({
                        type: 'low_captcha_success_rate',
                        severity: 'warning',
                        value: stats.successRate,
                        message: `CAPTCHA success rate is low: ${(stats.successRate * 100).toFixed(1)}%`
                    });
                }
            }
            
            this.healthStatus.services.captcha = {
                status: this.getServiceStatus(issues),
                lastCheck: Date.now(),
                issues
            };
            
        } catch (error) {
            this.healthStatus.services.captcha = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'captcha_check_failed',
                    severity: 'error',
                    message: `CAPTCHA health check failed: ${error.message}`
                }]
            };
        }
    }

    async checkFormatHealth() {
        const issues = [];
        
        try {
            const formatService = this.serviceReferences.format;
            if (!formatService) {
                issues.push({
                    type: 'service_not_registered',
                    severity: 'info',
                    message: 'Format service not registered for health monitoring'
                });
            } else {
                const stats = formatService.getFormatStats();
                
                // Check for formats with low success rates
                for (const [format, data] of Object.entries(stats.successRates)) {
                    if (data.attempts >= 5 && data.rate < 0.5) {
                        issues.push({
                            type: 'low_format_success_rate',
                            severity: 'warning',
                            value: data.rate,
                            format,
                            message: `Format ${format} has low success rate: ${(data.rate * 100).toFixed(1)}%`
                        });
                    }
                }
            }
            
            this.healthStatus.services.format = {
                status: this.getServiceStatus(issues),
                lastCheck: Date.now(),
                issues
            };
            
        } catch (error) {
            this.healthStatus.services.format = {
                status: 'error',
                lastCheck: Date.now(),
                issues: [{
                    type: 'format_check_failed',
                    severity: 'error',
                    message: `Format health check failed: ${error.message}`
                }]
            };
        }
    }

    getServiceStatus(issues) {
        if (issues.length === 0) return 'healthy';
        
        const hasCritical = issues.some(issue => issue.severity === 'critical');
        const hasError = issues.some(issue => issue.severity === 'error');
        const hasWarning = issues.some(issue => issue.severity === 'warning');
        
        if (hasCritical || hasError) return 'critical';
        if (hasWarning) return 'warning';
        return 'healthy';
    }

    updateOverallHealth() {
        const serviceStatuses = Object.values(this.healthStatus.services).map(service => service.status);
        
        if (serviceStatuses.includes('critical')) {
            this.healthStatus.overall = 'critical';
        } else if (serviceStatuses.includes('error')) {
            this.healthStatus.overall = 'degraded';
        } else if (serviceStatuses.includes('warning')) {
            this.healthStatus.overall = 'warning';
        } else {
            this.healthStatus.overall = 'healthy';
        }
    }

    async checkRecoveryNeeds() {
        if (!this.options.recoveryEnabled) return;
        
        const allIssues = [];
        
        // Collect all issues from all services
        for (const [serviceName, serviceHealth] of Object.entries(this.healthStatus.services)) {
            for (const issue of serviceHealth.issues) {
                allIssues.push({ ...issue, service: serviceName });
            }
        }
        
        // Group issues by type and trigger recovery actions
        const issueGroups = {};
        for (const issue of allIssues) {
            if (!issueGroups[issue.type]) {
                issueGroups[issue.type] = [];
            }
            issueGroups[issue.type].push(issue);
        }
        
        for (const [issueType, issues] of Object.entries(issueGroups)) {
            if (this.recoveryActions[issueType]) {
                await this.triggerRecovery(issueType, issues);
            }
        }
    }

    async triggerRecovery(issueType, issues) {
        const actions = this.recoveryActions[issueType];
        if (!actions || actions.length === 0) return;
        
        console.log(`🔧 Triggering recovery for ${issueType} (${issues.length} issues)`);
        
        // Sort actions by priority
        const sortedActions = actions.sort((a, b) => a.priority - b.priority);
        
        for (const actionConfig of sortedActions) {
            try {
                const success = await this.executeRecoveryAction(actionConfig.action, issueType, issues);
                
                this.recoveryHistory.push({
                    timestamp: Date.now(),
                    issueType,
                    action: actionConfig.action,
                    success,
                    issues: issues.length
                });
                
                this.healthStatus.metrics.recoveryActions++;
                
                if (success) {
                    console.log(`✅ Recovery action '${actionConfig.action}' completed successfully`);
                    break; // Stop trying other actions if this one succeeded
                } else {
                    console.log(`❌ Recovery action '${actionConfig.action}' failed`);
                }
                
            } catch (error) {
                console.error(`💥 Recovery action '${actionConfig.action}' threw error:`, error.message);
            }
        }
    }

    async executeRecoveryAction(action, issueType, issues) {
        console.log(`🔧 Executing recovery action: ${action}`);
        
        switch (action) {
            case 'reduce_concurrency':
                return this.reduceConcurrency();
                
            case 'restart_workers':
                return this.restartWorkers();
                
            case 'garbage_collect':
                return this.forceGarbageCollection();
                
            case 'clear_caches':
                return this.clearCaches();
                
            case 'cleanup_temp_files':
                return this.cleanupTempFiles();
                
            case 'rotate_logs':
                return this.rotateLogs();
                
            case 'switch_proxy_pool':
                return this.switchProxyPool();
                
            case 'refresh_cookies':
                return this.refreshCookies();
                
            case 'test_proxy_health':
                return this.testProxyHealth();
                
            case 'solve_captcha':
                return this.solveCaptcha();
                
            case 'restart_service':
                return this.restartService();
                
            default:
                console.warn(`⚠️ Unknown recovery action: ${action}`);
                return false;
        }
    }

    async reduceConcurrency() {
        try {
            const downloadService = this.serviceReferences.download;
            if (downloadService && typeof downloadService.reduceConcurrency === 'function') {
                await downloadService.reduceConcurrency();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to reduce concurrency:', error.message);
            return false;
        }
    }

    async restartWorkers() {
        try {
            // Implement worker restart logic here
            console.log('🔄 Restarting workers...');
            return true;
        } catch (error) {
            console.error('Failed to restart workers:', error.message);
            return false;
        }
    }

    async forceGarbageCollection() {
        try {
            if (global.gc) {
                global.gc();
                console.log('🗑️ Forced garbage collection');
                return true;
            } else {
                console.warn('⚠️ Garbage collection not available (run with --expose-gc)');
                return false;
            }
        } catch (error) {
            console.error('Failed to force garbage collection:', error.message);
            return false;
        }
    }

    async clearCaches() {
        try {
            // Clear various caches
            const downloadService = this.serviceReferences.download;
            if (downloadService && typeof downloadService.clearCache === 'function') {
                await downloadService.clearCache();
            }
            
            console.log('🧹 Cleared caches');
            return true;
        } catch (error) {
            console.error('Failed to clear caches:', error.message);
            return false;
        }
    }

    async cleanupTempFiles() {
        try {
            const tempDir = os.tmpdir();
            const downloaderTempFiles = fs.readdirSync(tempDir)
                .filter(file => file.startsWith('downloader-') || file.startsWith('yt-dlp-'))
                .map(file => ({ name: file, path: `${tempDir}/${file}` }));
            
            let cleaned = 0;
            for (const file of downloaderTempFiles) {
                try {
                    const stats = fs.statSync(file.path);
                    const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                    
                    if (ageHours > 1) { // Remove files older than 1 hour
                        fs.unlinkSync(file.path);
                        cleaned++;
                    }
                } catch (err) {
                    // File might have been deleted already
                }
            }
            
            console.log(`🧹 Cleaned up ${cleaned} temporary files`);
            return true;
        } catch (error) {
            console.error('Failed to cleanup temp files:', error.message);
            return false;
        }
    }

    async rotateLogs() {
        try {
            const errorService = this.serviceReferences.error;
            if (errorService && typeof errorService.rotateLogFile === 'function') {
                errorService.rotateLogFile();
                console.log('📋 Rotated log files');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to rotate logs:', error.message);
            return false;
        }
    }

    async switchProxyPool() {
        try {
            const proxyService = this.serviceReferences.proxy;
            if (proxyService && typeof proxyService.switchPool === 'function') {
                await proxyService.switchPool();
                console.log('🔄 Switched proxy pool');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to switch proxy pool:', error.message);
            return false;
        }
    }

    async refreshCookies() {
        try {
            const cookieService = this.serviceReferences.cookie;
            if (cookieService && typeof cookieService.refreshAll === 'function') {
                await cookieService.refreshAll();
                console.log('🍪 Refreshed cookies');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to refresh cookies:', error.message);
            return false;
        }
    }

    async testProxyHealth() {
        try {
            const proxyService = this.serviceReferences.proxy;
            if (proxyService && typeof proxyService.testAllProxies === 'function') {
                await proxyService.testAllProxies();
                console.log('🧪 Tested proxy health');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to test proxy health:', error.message);
            return false;
        }
    }

    async solveCaptcha() {
        try {
            const captchaService = this.serviceReferences.captcha;
            if (captchaService && typeof captchaService.preemptiveSolve === 'function') {
                await captchaService.preemptiveSolve();
                console.log('🧩 Solved CAPTCHA preemptively');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to solve CAPTCHA:', error.message);
            return false;
        }
    }

    async restartService() {
        if (!this.options.autoRestart) {
            console.log('⚠️ Auto restart is disabled');
            return false;
        }
        
        const now = Date.now();
        const recentRestarts = this.restartHistory.filter(
            restart => now - restart.timestamp < this.options.restartCooldown
        );
        
        if (recentRestarts.length >= this.options.maxRestartAttempts) {
            console.log('⚠️ Maximum restart attempts reached, skipping restart');
            return false;
        }
        
        try {
            console.log('🔄 Restarting service...');
            
            this.restartHistory.push({
                timestamp: now,
                reason: 'health_check_recovery'
            });
            
            // Emit restart event for external handling
            this.emit('service_restart_requested', {
                reason: 'health_check_recovery',
                timestamp: now
            });
            
            return true;
        } catch (error) {
            console.error('Failed to restart service:', error.message);
            return false;
        }
    }

    async getCpuUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                
                const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
                const totalCpuTime = endUsage.user + endUsage.system;
                const cpuPercent = (totalCpuTime / totalTime) * 100;
                
                resolve(Math.min(cpuPercent, 100)); // Cap at 100%
            }, 100);
        });
    }

    getMemoryUsage() {
        const memUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        return (memUsage.rss / totalMemory) * 100;
    }

    async getDiskUsage() {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const df = spawn('df', ['-h', process.cwd()]);
            
            let output = '';
            df.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            df.on('close', () => {
                try {
                    const lines = output.trim().split('\n');
                    if (lines.length >= 2) {
                        const parts = lines[1].split(/\s+/);
                        const usagePercent = parseInt(parts[4].replace('%', ''));
                        resolve(usagePercent);
                    } else {
                        resolve(0);
                    }
                } catch (error) {
                    resolve(0);
                }
            });
            
            df.on('error', () => {
                resolve(0);
            });
            
            setTimeout(() => {
                df.kill();
                resolve(0);
            }, 5000);
        });
    }

    getHealthStatus() {
        return {
            ...this.healthStatus,
            uptime: Date.now() - this.healthStatus.metrics.uptime,
            isMonitoring: this.isMonitoring
        };
    }

    getRecoveryHistory(limit = 50) {
        return this.recoveryHistory
            .slice(-limit)
            .map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp).toISOString()
            }));
    }

    getRestartHistory(limit = 10) {
        return this.restartHistory
            .slice(-limit)
            .map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp).toISOString()
            }));
    }

    resetMetrics() {
        this.healthStatus.metrics = {
            uptime: Date.now(),
            totalChecks: 0,
            healthyChecks: 0,
            lastIncident: null,
            recoveryActions: 0
        };
        
        this.recoveryHistory = [];
        this.restartHistory = [];
        
        console.log('📊 Health monitoring metrics reset');
    }
}

export default HealthMonitoringService;