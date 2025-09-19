import { EventEmitter } from 'events';

class RetryMechanismService extends EventEmitter {
    constructor() {
        super();
        this.failurePatterns = new Map();
        this.retryStrategies = {
            'rate_limit': { baseDelay: 60000, maxDelay: 300000, backoffMultiplier: 2 },
            'auth_error': { baseDelay: 30000, maxDelay: 120000, backoffMultiplier: 1.5 },
            'network_error': { baseDelay: 5000, maxDelay: 60000, backoffMultiplier: 2 },
            'server_error': { baseDelay: 10000, maxDelay: 180000, backoffMultiplier: 2.5 },
            'captcha_required': { baseDelay: 120000, maxDelay: 600000, backoffMultiplier: 1.2 },
            'geo_blocked': { baseDelay: 0, maxDelay: 0, backoffMultiplier: 1 }, // Immediate proxy switch
            'video_unavailable': { baseDelay: 0, maxDelay: 0, backoffMultiplier: 1 }, // No retry
            'default': { baseDelay: 15000, maxDelay: 120000, backoffMultiplier: 2 }
        };
        this.globalRetryStats = {
            totalAttempts: 0,
            totalSuccesses: 0,
            totalFailures: 0,
            averageRetryCount: 0
        };
    }

    analyzeError(error, context = {}) {
        const errorAnalysis = {
            type: 'unknown',
            severity: 'medium',
            shouldRetry: true,
            requiresProxySwitch: false,
            requiresCookieRefresh: false,
            requiresCaptchaSolving: false,
            estimatedRecoveryTime: 30000
        };

        const errorMessage = error.message || error.toString();
        const errorLower = errorMessage.toLowerCase();

        // Rate limiting detection
        if (errorLower.includes('429') || 
            errorLower.includes('too many requests') ||
            errorLower.includes('rate limit') ||
            errorLower.includes('quota exceeded')) {
            errorAnalysis.type = 'rate_limit';
            errorAnalysis.severity = 'high';
            errorAnalysis.requiresProxySwitch = true;
            errorAnalysis.estimatedRecoveryTime = 300000; // 5 minutes
        }
        
        // Authentication errors
        else if (errorLower.includes('login_required') ||
                 errorLower.includes('sign in to confirm') ||
                 errorLower.includes('authentication') ||
                 errorLower.includes('unauthorized') ||
                 errorLower.includes('403')) {
            errorAnalysis.type = 'auth_error';
            errorAnalysis.severity = 'high';
            errorAnalysis.requiresCookieRefresh = true;
            errorAnalysis.estimatedRecoveryTime = 120000; // 2 minutes
        }
        
        // CAPTCHA detection
        else if (errorLower.includes('captcha') ||
                 errorLower.includes('verify you are human') ||
                 errorLower.includes('unusual traffic')) {
            errorAnalysis.type = 'captcha_required';
            errorAnalysis.severity = 'critical';
            errorAnalysis.requiresCaptchaSolving = true;
            errorAnalysis.requiresProxySwitch = true;
            errorAnalysis.estimatedRecoveryTime = 600000; // 10 minutes
        }
        
        // Geo-blocking
        else if (errorLower.includes('not available in your country') ||
                 errorLower.includes('geo') ||
                 errorLower.includes('region') ||
                 errorLower.includes('blocked in your location')) {
            errorAnalysis.type = 'geo_blocked';
            errorAnalysis.severity = 'medium';
            errorAnalysis.requiresProxySwitch = true;
            errorAnalysis.estimatedRecoveryTime = 0; // Immediate
        }
        
        // Network errors
        else if (errorLower.includes('network') ||
                 errorLower.includes('connection') ||
                 errorLower.includes('timeout') ||
                 errorLower.includes('econnreset') ||
                 errorLower.includes('enotfound')) {
            errorAnalysis.type = 'network_error';
            errorAnalysis.severity = 'medium';
            errorAnalysis.requiresProxySwitch = Math.random() > 0.5; // 50% chance
            errorAnalysis.estimatedRecoveryTime = 30000; // 30 seconds
        }
        
        // Server errors
        else if (errorLower.includes('500') ||
                 errorLower.includes('502') ||
                 errorLower.includes('503') ||
                 errorLower.includes('504') ||
                 errorLower.includes('internal server error')) {
            errorAnalysis.type = 'server_error';
            errorAnalysis.severity = 'medium';
            errorAnalysis.estimatedRecoveryTime = 60000; // 1 minute
        }
        
        // Video unavailable (permanent failure)
        else if (errorLower.includes('video unavailable') ||
                 errorLower.includes('private video') ||
                 errorLower.includes('deleted') ||
                 errorLower.includes('removed')) {
            errorAnalysis.type = 'video_unavailable';
            errorAnalysis.severity = 'critical';
            errorAnalysis.shouldRetry = false;
            errorAnalysis.estimatedRecoveryTime = 0;
        }

        // Store failure pattern for analysis
        this.recordFailurePattern(errorAnalysis.type, context);

        console.log(`🔍 Error Analysis:`, {
            type: errorAnalysis.type,
            severity: errorAnalysis.severity,
            shouldRetry: errorAnalysis.shouldRetry,
            requiresProxySwitch: errorAnalysis.requiresProxySwitch,
            requiresCookieRefresh: errorAnalysis.requiresCookieRefresh,
            estimatedRecoveryTime: errorAnalysis.estimatedRecoveryTime
        });

        return errorAnalysis;
    }

    recordFailurePattern(errorType, context) {
        const key = `${errorType}_${context.url || 'unknown'}`;
        
        if (!this.failurePatterns.has(key)) {
            this.failurePatterns.set(key, {
                count: 0,
                firstOccurrence: Date.now(),
                lastOccurrence: Date.now(),
                contexts: []
            });
        }

        const pattern = this.failurePatterns.get(key);
        pattern.count++;
        pattern.lastOccurrence = Date.now();
        pattern.contexts.push({
            timestamp: Date.now(),
            ...context
        });

        // Keep only last 10 contexts
        if (pattern.contexts.length > 10) {
            pattern.contexts = pattern.contexts.slice(-10);
        }
    }

    calculateRetryDelay(attempt, errorType, context = {}) {
        const strategy = this.retryStrategies[errorType] || this.retryStrategies.default;
        
        // Base exponential backoff
        let delay = Math.min(
            strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt - 1),
            strategy.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = delay * 0.1 * Math.random();
        delay += jitter;

        // Analyze failure patterns for this error type
        const patternKey = `${errorType}_${context.url || 'unknown'}`;
        const pattern = this.failurePatterns.get(patternKey);
        
        if (pattern && pattern.count > 3) {
            // If we've seen this error frequently, increase delay
            const frequencyMultiplier = Math.min(pattern.count / 3, 3);
            delay *= frequencyMultiplier;
            
            console.log(`⚠️ Frequent failure pattern detected for ${errorType}, increasing delay by ${frequencyMultiplier}x`);
        }

        // Check global failure rate
        const globalFailureRate = this.globalRetryStats.totalFailures / 
            Math.max(this.globalRetryStats.totalAttempts, 1);
        
        if (globalFailureRate > 0.7) {
            // High global failure rate, be more conservative
            delay *= 2;
            console.log(`🚨 High global failure rate (${(globalFailureRate * 100).toFixed(1)}%), doubling delay`);
        }

        return Math.floor(delay);
    }

    shouldRetry(attempt, maxAttempts, errorAnalysis, context = {}) {
        // Don't retry if error analysis says not to
        if (!errorAnalysis.shouldRetry) {
            console.log(`❌ Error type '${errorAnalysis.type}' is not retryable`);
            return false;
        }

        // Don't retry if we've exceeded max attempts
        if (attempt >= maxAttempts) {
            console.log(`❌ Maximum retry attempts (${maxAttempts}) exceeded`);
            return false;
        }

        // Check if we're in a failure spiral for this specific pattern
        const patternKey = `${errorAnalysis.type}_${context.url || 'unknown'}`;
        const pattern = this.failurePatterns.get(patternKey);
        
        if (pattern && pattern.count > 10) {
            const timeSinceFirst = Date.now() - pattern.firstOccurrence;
            if (timeSinceFirst < 300000) { // 5 minutes
                console.log(`🌀 Failure spiral detected for ${errorAnalysis.type}, backing off`);
                return false;
            }
        }

        // Critical errors need special handling
        if (errorAnalysis.severity === 'critical' && attempt > 2) {
            console.log(`🚨 Critical error, limiting retries to 2 attempts`);
            return false;
        }

        return true;
    }

    async executeWithRetry(operation, options = {}) {
        const {
            maxAttempts = 5,
            context = {},
            onRetry = null,
            onProxySwitch = null,
            onCookieRefresh = null,
            onCaptchaSolve = null
        } = options;

        let lastError = null;
        let attempt = 1;

        while (attempt <= maxAttempts) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxAttempts}`);
                
                this.globalRetryStats.totalAttempts++;
                const result = await operation(attempt, context);
                
                this.globalRetryStats.totalSuccesses++;
                this.updateAverageRetryCount(attempt);
                
                console.log(`✅ Operation succeeded on attempt ${attempt}`);
                return result;
                
            } catch (error) {
                lastError = error;
                this.globalRetryStats.totalFailures++;
                
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                const errorAnalysis = this.analyzeError(error, context);
                
                if (!this.shouldRetry(attempt, maxAttempts, errorAnalysis, context)) {
                    break;
                }

                // Execute recovery actions based on error analysis
                if (errorAnalysis.requiresProxySwitch && onProxySwitch) {
                    console.log('🔄 Switching proxy due to error analysis');
                    await onProxySwitch(errorAnalysis);
                }
                
                if (errorAnalysis.requiresCookieRefresh && onCookieRefresh) {
                    console.log('🍪 Refreshing cookies due to error analysis');
                    await onCookieRefresh(errorAnalysis);
                }
                
                if (errorAnalysis.requiresCaptchaSolving && onCaptchaSolve) {
                    console.log('🤖 Attempting CAPTCHA solving');
                    await onCaptchaSolve(errorAnalysis);
                }

                if (attempt < maxAttempts) {
                    const delay = this.calculateRetryDelay(attempt, errorAnalysis.type, context);
                    console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}`);
                    
                    if (onRetry) {
                        await onRetry(attempt, delay, errorAnalysis);
                    }
                    
                    await this.sleep(delay);
                }
                
                attempt++;
            }
        }

        // All retries exhausted
        console.log(`💥 All ${maxAttempts} attempts failed`);
        this.emit('allRetriesExhausted', {
            attempts: maxAttempts,
            lastError,
            context
        });
        
        throw lastError;
    }

    updateAverageRetryCount(attempts) {
        const totalOperations = this.globalRetryStats.totalSuccesses;
        const currentAverage = this.globalRetryStats.averageRetryCount;
        
        this.globalRetryStats.averageRetryCount = 
            (currentAverage * (totalOperations - 1) + attempts) / totalOperations;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getFailurePatterns() {
        const patterns = {};
        for (const [key, pattern] of this.failurePatterns.entries()) {
            patterns[key] = {
                ...pattern,
                frequency: pattern.count / ((Date.now() - pattern.firstOccurrence) / 3600000), // per hour
                duration: Date.now() - pattern.firstOccurrence
            };
        }
        return patterns;
    }

    getStats() {
        return this.getRetryStats();
    }

    getRetryStats() {
        return {
            ...this.globalRetryStats,
            successRate: this.globalRetryStats.totalSuccesses / 
                Math.max(this.globalRetryStats.totalAttempts, 1),
            failurePatternCount: this.failurePatterns.size
        };
    }

    resetStats() {
        this.globalRetryStats = {
            totalAttempts: 0,
            totalSuccesses: 0,
            totalFailures: 0,
            averageRetryCount: 0
        };
        this.failurePatterns.clear();
        console.log('📊 Retry statistics reset');
    }

    printRetryStats() {
        const stats = this.getRetryStats();
        console.log('\n📊 Retry Mechanism Statistics:');
        console.log(`  Total attempts: ${stats.totalAttempts}`);
        console.log(`  Successes: ${stats.totalSuccesses}`);
        console.log(`  Failures: ${stats.totalFailures}`);
        console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`  Average retry count: ${stats.averageRetryCount.toFixed(2)}`);
        console.log(`  Failure patterns tracked: ${stats.failurePatternCount}`);
        
        // Show top failure patterns
        const patterns = this.getFailurePatterns();
        const sortedPatterns = Object.entries(patterns)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5);
            
        if (sortedPatterns.length > 0) {
            console.log('\n🔍 Top Failure Patterns:');
            sortedPatterns.forEach(([key, pattern]) => {
                console.log(`  ${key}: ${pattern.count} occurrences (${pattern.frequency.toFixed(2)}/hour)`);
            });
        }
    }
}

export default RetryMechanismService;