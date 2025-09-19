import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

class ErrorHandlingService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            logLevel: options.logLevel || 'info',
            logToFile: options.logToFile !== false,
            logToConsole: options.logToConsole !== false,
            logDirectory: options.logDirectory || path.join(process.cwd(), 'logs'),
            maxLogFiles: options.maxLogFiles || 10,
            maxLogSize: options.maxLogSize || 50 * 1024 * 1024, // 50MB
            enableMetrics: options.enableMetrics !== false,
            enableAlerts: options.enableAlerts !== false,
            alertThresholds: {
                errorRate: 0.1, // 10% error rate
                consecutiveFailures: 5,
                responseTime: 30000, // 30 seconds
                ...options.alertThresholds
            }
        };
        
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.currentLogLevel = this.logLevels[this.options.logLevel] || 2;
        
        this.errorCategories = {
            NETWORK: 'network',
            AUTHENTICATION: 'authentication',
            RATE_LIMIT: 'rate_limit',
            CAPTCHA: 'captcha',
            FORMAT: 'format',
            PROXY: 'proxy',
            COOKIE: 'cookie',
            DOWNLOAD: 'download',
            SYSTEM: 'system',
            VALIDATION: 'validation',
            TIMEOUT: 'timeout',
            UNKNOWN: 'unknown'
        };
        
        this.errorPatterns = {
            // Network errors
            'ECONNREFUSED': { category: 'NETWORK', severity: 'high', recoverable: true },
            'ENOTFOUND': { category: 'NETWORK', severity: 'high', recoverable: true },
            'ETIMEDOUT': { category: 'TIMEOUT', severity: 'medium', recoverable: true },
            'ECONNRESET': { category: 'NETWORK', severity: 'medium', recoverable: true },
            
            // YouTube specific errors
            'Sign in to confirm': { category: 'AUTHENTICATION', severity: 'high', recoverable: true },
            'Video unavailable': { category: 'VALIDATION', severity: 'low', recoverable: false },
            'Private video': { category: 'AUTHENTICATION', severity: 'low', recoverable: false },
            'This video is not available': { category: 'VALIDATION', severity: 'low', recoverable: false },
            'HTTP Error 429': { category: 'RATE_LIMIT', severity: 'high', recoverable: true },
            'HTTP Error 403': { category: 'AUTHENTICATION', severity: 'high', recoverable: true },
            'HTTP Error 404': { category: 'VALIDATION', severity: 'low', recoverable: false },
            'HTTP Error 500': { category: 'SYSTEM', severity: 'medium', recoverable: true },
            'HTTP Error 503': { category: 'SYSTEM', severity: 'medium', recoverable: true },
            
            // Format errors
            'No video formats found': { category: 'FORMAT', severity: 'medium', recoverable: true },
            'Requested format not available': { category: 'FORMAT', severity: 'medium', recoverable: true },
            'Unable to extract': { category: 'FORMAT', severity: 'high', recoverable: true },
            
            // Proxy errors
            'Proxy connection failed': { category: 'PROXY', severity: 'medium', recoverable: true },
            'Proxy authentication required': { category: 'PROXY', severity: 'high', recoverable: true },
            
            // CAPTCHA errors
            'CAPTCHA': { category: 'CAPTCHA', severity: 'high', recoverable: true },
            'Please complete the security check': { category: 'CAPTCHA', severity: 'high', recoverable: true },
            
            // Cookie errors
            'Cookie expired': { category: 'COOKIE', severity: 'medium', recoverable: true },
            'Invalid session': { category: 'COOKIE', severity: 'medium', recoverable: true }
        };
        
        this.metrics = {
            totalRequests: 0,
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsByHour: new Map(),
            responseTimeHistory: [],
            consecutiveFailures: 0,
            lastSuccessTime: Date.now(),
            alertsSent: new Map()
        };
        
        this.recoveryStrategies = {
            NETWORK: ['retry_with_delay', 'switch_proxy', 'reduce_concurrency'],
            AUTHENTICATION: ['refresh_cookies', 'switch_account', 'solve_captcha'],
            RATE_LIMIT: ['exponential_backoff', 'switch_proxy', 'reduce_rate'],
            CAPTCHA: ['solve_captcha', 'switch_proxy', 'refresh_cookies'],
            FORMAT: ['try_fallback_format', 'refresh_metadata', 'switch_extractor'],
            PROXY: ['switch_proxy', 'test_proxy_health', 'fallback_direct'],
            COOKIE: ['refresh_cookies', 'switch_account', 'clear_session'],
            DOWNLOAD: ['retry_download', 'switch_format', 'resume_download'],
            SYSTEM: ['retry_with_delay', 'check_system_resources', 'restart_service'],
            TIMEOUT: ['increase_timeout', 'switch_proxy', 'reduce_concurrency']
        };
        
        this.initializeLogging();
        this.startMetricsCollection();
        
        console.log('🛡️ Error Handling Service initialized');
        console.log(`   Log level: ${this.options.logLevel}`);
        console.log(`   Log to file: ${this.options.logToFile}`);
        console.log(`   Metrics enabled: ${this.options.enableMetrics}`);
    }

    initializeLogging() {
        if (this.options.logToFile) {
            // Create logs directory if it doesn't exist
            if (!fs.existsSync(this.options.logDirectory)) {
                fs.mkdirSync(this.options.logDirectory, { recursive: true });
            }
            
            // Set up log rotation
            this.setupLogRotation();
        }
    }

    setupLogRotation() {
        const logFiles = fs.readdirSync(this.options.logDirectory)
            .filter(file => file.startsWith('downloader-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(this.options.logDirectory, file),
                stats: fs.statSync(path.join(this.options.logDirectory, file))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);
        
        // Remove old log files if we exceed the limit
        if (logFiles.length >= this.options.maxLogFiles) {
            const filesToRemove = logFiles.slice(this.options.maxLogFiles - 1);
            for (const file of filesToRemove) {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Removed old log file: ${file.name}`);
                } catch (error) {
                    console.error(`Failed to remove log file ${file.name}:`, error.message);
                }
            }
        }
        
        // Check current log file size
        const currentLogFile = this.getCurrentLogFile();
        if (fs.existsSync(currentLogFile)) {
            const stats = fs.statSync(currentLogFile);
            if (stats.size > this.options.maxLogSize) {
                this.rotateLogFile();
            }
        }
    }

    getCurrentLogFile() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.options.logDirectory, `downloader-${date}.log`);
    }

    rotateLogFile() {
        const currentFile = this.getCurrentLogFile();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(
            this.options.logDirectory,
            `downloader-${timestamp}.log`
        );
        
        try {
            fs.renameSync(currentFile, rotatedFile);
            console.log(`🔄 Log file rotated: ${path.basename(rotatedFile)}`);
        } catch (error) {
            console.error('Failed to rotate log file:', error.message);
        }
    }

    log(level, message, context = {}) {
        if (this.logLevels[level] > this.currentLogLevel) {
            return;
        }
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            context,
            pid: process.pid
        };
        
        const logLine = this.formatLogEntry(logEntry);
        
        // Log to console
        if (this.options.logToConsole) {
            this.logToConsole(level, logLine);
        }
        
        // Log to file
        if (this.options.logToFile) {
            this.logToFile(logLine);
        }
        
        // Emit log event
        this.emit('log', logEntry);
    }

    formatLogEntry(entry) {
        const contextStr = Object.keys(entry.context).length > 0 
            ? ` | ${JSON.stringify(entry.context)}`
            : '';
        
        return `[${entry.timestamp}] [${entry.level}] [PID:${entry.pid}] ${entry.message}${contextStr}`;
    }

    logToConsole(level, message) {
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[35m', // Magenta
            trace: '\x1b[37m'  // White
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || colors.info;
        
        console.log(`${color}${message}${reset}`);
    }

    logToFile(message) {
        try {
            const logFile = this.getCurrentLogFile();
            fs.appendFileSync(logFile, message + '\n');
            
            // Check if we need to rotate
            const stats = fs.statSync(logFile);
            if (stats.size > this.options.maxLogSize) {
                this.rotateLogFile();
            }
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    handleError(error, context = {}) {
        const errorInfo = this.analyzeError(error);
        const errorId = this.generateErrorId();
        
        const enrichedContext = {
            ...context,
            errorId,
            category: errorInfo.category,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            timestamp: Date.now(),
            stack: error.stack
        };
        
        // Log the error
        this.log('error', `${errorInfo.category} Error: ${error.message}`, enrichedContext);
        
        // Update metrics
        this.updateErrorMetrics(errorInfo.category);
        
        // Check for alerts
        this.checkAlertConditions(errorInfo);
        
        // Determine recovery strategy
        const recoveryActions = this.getRecoveryActions(errorInfo.category, errorInfo.severity);
        
        // Emit error event
        this.emit('error', {
            error,
            errorInfo,
            context: enrichedContext,
            recoveryActions,
            errorId
        });
        
        return {
            errorId,
            category: errorInfo.category,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            recoveryActions,
            context: enrichedContext
        };
    }

    analyzeError(error) {
        const errorMessage = error.message || error.toString();
        
        // Check against known error patterns
        for (const [pattern, info] of Object.entries(this.errorPatterns)) {
            if (errorMessage.includes(pattern)) {
                return {
                    category: this.errorCategories[info.category],
                    severity: info.severity,
                    recoverable: info.recoverable,
                    pattern
                };
            }
        }
        
        // Check error code
        if (error.code) {
            const codeInfo = this.errorPatterns[error.code];
            if (codeInfo) {
                return {
                    category: this.errorCategories[codeInfo.category],
                    severity: codeInfo.severity,
                    recoverable: codeInfo.recoverable,
                    pattern: error.code
                };
            }
        }
        
        // Default classification
        return {
            category: this.errorCategories.UNKNOWN,
            severity: 'medium',
            recoverable: true,
            pattern: 'unknown'
        };
    }

    generateErrorId() {
        return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateErrorMetrics(category) {
        this.metrics.totalErrors++;
        
        // Update category count
        const currentCount = this.metrics.errorsByCategory.get(category) || 0;
        this.metrics.errorsByCategory.set(category, currentCount + 1);
        
        // Update hourly count
        const hour = new Date().getHours();
        const hourlyCount = this.metrics.errorsByHour.get(hour) || 0;
        this.metrics.errorsByHour.set(hour, hourlyCount + 1);
        
        // Update consecutive failures
        this.metrics.consecutiveFailures++;
    }

    recordSuccess(responseTime = null) {
        this.metrics.totalRequests++;
        this.metrics.consecutiveFailures = 0;
        this.metrics.lastSuccessTime = Date.now();
        
        if (responseTime !== null) {
            this.metrics.responseTimeHistory.push({
                time: responseTime,
                timestamp: Date.now()
            });
            
            // Keep only last 1000 response times
            if (this.metrics.responseTimeHistory.length > 1000) {
                this.metrics.responseTimeHistory.shift();
            }
        }
        
        this.log('debug', 'Operation completed successfully', {
            responseTime,
            consecutiveFailures: this.metrics.consecutiveFailures
        });
    }

    getRecoveryActions(category, severity) {
        const strategies = this.recoveryStrategies[category.toUpperCase()] || ['retry_with_delay'];
        
        // Filter strategies based on severity
        let selectedStrategies = [...strategies];
        
        if (severity === 'low') {
            selectedStrategies = selectedStrategies.slice(0, 1); // Only first strategy
        } else if (severity === 'high') {
            selectedStrategies = strategies; // All strategies
        }
        
        return selectedStrategies.map(strategy => ({
            action: strategy,
            priority: strategies.indexOf(strategy) + 1,
            description: this.getActionDescription(strategy)
        }));
    }

    getActionDescription(action) {
        const descriptions = {
            'retry_with_delay': 'Retry the operation after a delay',
            'switch_proxy': 'Switch to a different proxy server',
            'reduce_concurrency': 'Reduce the number of concurrent operations',
            'refresh_cookies': 'Refresh authentication cookies',
            'switch_account': 'Switch to a different account',
            'solve_captcha': 'Attempt to solve CAPTCHA challenge',
            'exponential_backoff': 'Apply exponential backoff delay',
            'reduce_rate': 'Reduce request rate',
            'try_fallback_format': 'Try alternative video format',
            'refresh_metadata': 'Refresh video metadata',
            'switch_extractor': 'Switch to alternative extractor',
            'test_proxy_health': 'Test proxy server health',
            'fallback_direct': 'Fallback to direct connection',
            'clear_session': 'Clear session data',
            'retry_download': 'Retry the download operation',
            'switch_format': 'Switch to different format',
            'resume_download': 'Resume interrupted download',
            'check_system_resources': 'Check system resource availability',
            'restart_service': 'Restart the service',
            'increase_timeout': 'Increase operation timeout'
        };
        
        return descriptions[action] || 'Unknown recovery action';
    }

    checkAlertConditions(errorInfo) {
        if (!this.options.enableAlerts) return;
        
        const now = Date.now();
        const thresholds = this.options.alertThresholds;
        
        // Check error rate
        if (this.metrics.totalRequests > 10) {
            const errorRate = this.metrics.totalErrors / this.metrics.totalRequests;
            if (errorRate > thresholds.errorRate) {
                this.sendAlert('high_error_rate', {
                    errorRate: (errorRate * 100).toFixed(2),
                    totalErrors: this.metrics.totalErrors,
                    totalRequests: this.metrics.totalRequests
                });
            }
        }
        
        // Check consecutive failures
        if (this.metrics.consecutiveFailures >= thresholds.consecutiveFailures) {
            this.sendAlert('consecutive_failures', {
                consecutiveFailures: this.metrics.consecutiveFailures,
                lastSuccessTime: new Date(this.metrics.lastSuccessTime).toISOString()
            });
        }
        
        // Check response time
        if (this.metrics.responseTimeHistory.length > 0) {
            const recentTimes = this.metrics.responseTimeHistory
                .filter(entry => now - entry.timestamp < 300000) // Last 5 minutes
                .map(entry => entry.time);
            
            if (recentTimes.length > 0) {
                const avgResponseTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
                if (avgResponseTime > thresholds.responseTime) {
                    this.sendAlert('slow_response_time', {
                        averageResponseTime: Math.round(avgResponseTime),
                        threshold: thresholds.responseTime,
                        samples: recentTimes.length
                    });
                }
            }
        }
    }

    sendAlert(type, data) {
        const alertKey = `${type}_${Math.floor(Date.now() / 300000)}`; // 5-minute window
        
        if (this.metrics.alertsSent.has(alertKey)) {
            return; // Already sent this alert in this time window
        }
        
        this.metrics.alertsSent.set(alertKey, Date.now());
        
        const alert = {
            type,
            timestamp: new Date().toISOString(),
            data,
            severity: this.getAlertSeverity(type)
        };
        
        this.log('warn', `ALERT: ${type}`, alert);
        this.emit('alert', alert);
        
        // Clean up old alert records
        const cutoff = Date.now() - 3600000; // 1 hour
        for (const [key, timestamp] of this.metrics.alertsSent) {
            if (timestamp < cutoff) {
                this.metrics.alertsSent.delete(key);
            }
        }
    }

    getAlertSeverity(type) {
        const severityMap = {
            'high_error_rate': 'critical',
            'consecutive_failures': 'critical',
            'slow_response_time': 'warning',
            'system_resource_low': 'warning',
            'proxy_failure_rate': 'warning'
        };
        
        return severityMap[type] || 'info';
    }

    startMetricsCollection() {
        if (!this.options.enableMetrics) return;
        
        // Collect metrics every minute
        setInterval(() => {
            this.collectSystemMetrics();
        }, 60000);
        
        // Clean up old metrics every hour
        setInterval(() => {
            this.cleanupMetrics();
        }, 3600000);
    }

    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.log('trace', 'System metrics collected', {
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: Math.round(process.uptime())
        });
    }

    cleanupMetrics() {
        // Clean up old response time history
        const cutoff = Date.now() - 3600000; // 1 hour
        this.metrics.responseTimeHistory = this.metrics.responseTimeHistory
            .filter(entry => entry.timestamp > cutoff);
        
        this.log('debug', 'Metrics cleanup completed', {
            responseTimeEntries: this.metrics.responseTimeHistory.length
        });
    }

    getMetrics() {
        const now = Date.now();
        const errorRate = this.metrics.totalRequests > 0 
            ? this.metrics.totalErrors / this.metrics.totalRequests 
            : 0;
        
        const recentResponseTimes = this.metrics.responseTimeHistory
            .filter(entry => now - entry.timestamp < 300000) // Last 5 minutes
            .map(entry => entry.time);
        
        const avgResponseTime = recentResponseTimes.length > 0
            ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
            : 0;
        
        return {
            totalRequests: this.metrics.totalRequests,
            totalErrors: this.metrics.totalErrors,
            errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimal places
            consecutiveFailures: this.metrics.consecutiveFailures,
            lastSuccessTime: new Date(this.metrics.lastSuccessTime).toISOString(),
            averageResponseTime: Math.round(avgResponseTime),
            errorsByCategory: Object.fromEntries(this.metrics.errorsByCategory),
            errorsByHour: Object.fromEntries(this.metrics.errorsByHour),
            alertsSent: this.metrics.alertsSent.size,
            systemHealth: this.getSystemHealth()
        };
    }

    getSystemHealth() {
        const errorRate = this.metrics.totalRequests > 0 
            ? this.metrics.totalErrors / this.metrics.totalRequests 
            : 0;
        
        let health = 'healthy';
        
        if (errorRate > 0.5 || this.metrics.consecutiveFailures > 10) {
            health = 'critical';
        } else if (errorRate > 0.2 || this.metrics.consecutiveFailures > 5) {
            health = 'degraded';
        } else if (errorRate > 0.1 || this.metrics.consecutiveFailures > 2) {
            health = 'warning';
        }
        
        return health;
    }

    exportLogs(startTime, endTime, level = null) {
        const logs = [];
        const logFiles = fs.readdirSync(this.options.logDirectory)
            .filter(file => file.startsWith('downloader-') && file.endsWith('.log'))
            .map(file => path.join(this.options.logDirectory, file));
        
        for (const logFile of logFiles) {
            try {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    const match = line.match(/^\[(.*?)\] \[(.*?)\] \[PID:(\d+)\] (.*)$/);
                    if (match) {
                        const [, timestamp, logLevel, pid, message] = match;
                        const logTime = new Date(timestamp).getTime();
                        
                        if (logTime >= startTime && logTime <= endTime) {
                            if (!level || logLevel.toLowerCase() === level.toLowerCase()) {
                                logs.push({
                                    timestamp,
                                    level: logLevel,
                                    pid: parseInt(pid),
                                    message,
                                    file: path.basename(logFile)
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                this.log('warn', `Failed to read log file ${logFile}`, { error: error.message });
            }
        }
        
        return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Convenience methods
    error(message, context = {}) {
        this.log('error', message, context);
    }

    warn(message, context = {}) {
        this.log('warn', message, context);
    }

    info(message, context = {}) {
        this.log('info', message, context);
    }

    debug(message, context = {}) {
        this.log('debug', message, context);
    }

    trace(message, context = {}) {
        this.log('trace', message, context);
    }
}

export default ErrorHandlingService;