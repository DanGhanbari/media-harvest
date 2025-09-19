import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CookieManagementService {
    constructor() {
        this.cookiesDir = path.join(__dirname, '../../.cookies');
        this.accountsDir = path.join(this.cookiesDir, 'accounts');
        this.currentAccountIndex = 0;
        this.cookieAccounts = [];
        this.cookieStats = new Map();
        this.refreshInProgress = new Set();
        this.initializeCookieSystem();
    }

    initializeCookieSystem() {
        // Ensure directories exist
        if (!fs.existsSync(this.cookiesDir)) {
            fs.mkdirSync(this.cookiesDir, { recursive: true });
        }
        if (!fs.existsSync(this.accountsDir)) {
            fs.mkdirSync(this.accountsDir, { recursive: true });
        }

        this.loadCookieAccounts();
        this.startCookieHealthMonitoring();
    }

    loadCookieAccounts() {
        try {
            const accountFiles = fs.readdirSync(this.accountsDir)
                .filter(file => file.endsWith('.txt'))
                .map(file => {
                    const accountName = file.replace('.txt', '');
                    const filePath = path.join(this.accountsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    return {
                        name: accountName,
                        path: filePath,
                        lastModified: stats.mtime,
                        size: stats.size,
                        active: true
                    };
                });

            this.cookieAccounts = accountFiles;
            console.log(`🍪 Loaded ${this.cookieAccounts.length} cookie accounts`);
            
            // Initialize stats for each account
            this.cookieAccounts.forEach(account => {
                if (!this.cookieStats.has(account.name)) {
                    this.cookieStats.set(account.name, {
                        successes: 0,
                        failures: 0,
                        lastUsed: null,
                        lastRefresh: account.lastModified,
                        isValid: true
                    });
                }
            });

            // If no accounts exist, create a default one
            if (this.cookieAccounts.length === 0) {
                this.createDefaultCookieAccount();
            }
        } catch (error) {
            console.error('❌ Error loading cookie accounts:', error);
        }
    }

    createDefaultCookieAccount() {
        const defaultPath = path.join(this.accountsDir, 'default.txt');
        const mainCookiePath = path.join(this.cookiesDir, 'youtube.txt');
        
        // Copy main cookie file if it exists
        if (fs.existsSync(mainCookiePath)) {
            fs.copyFileSync(mainCookiePath, defaultPath);
            console.log('📋 Created default cookie account from main cookie file');
        } else {
            // Create empty cookie file
            fs.writeFileSync(defaultPath, '# Netscape HTTP Cookie File\n');
            console.log('📝 Created empty default cookie account');
        }
        
        this.loadCookieAccounts();
    }

    getNextCookieAccount() {
        const activeAccounts = this.cookieAccounts.filter(account => 
            account.active && this.cookieStats.get(account.name)?.isValid
        );

        if (activeAccounts.length === 0) {
            console.log('⚠️ No active cookie accounts available');
            return null;
        }

        // Use round-robin selection
        const account = activeAccounts[this.currentAccountIndex % activeAccounts.length];
        this.currentAccountIndex = (this.currentAccountIndex + 1) % activeAccounts.length;

        // Update last used time
        const stats = this.cookieStats.get(account.name);
        stats.lastUsed = Date.now();

        console.log(`🍪 Using cookie account: ${account.name}`);
        return account;
    }

    markCookieSuccess(accountName) {
        const stats = this.cookieStats.get(accountName);
        if (stats) {
            stats.successes++;
            stats.isValid = true;
            console.log(`✅ Cookie account ${accountName} successful`);
        }
    }

    markCookieFailure(accountName, error) {
        const stats = this.cookieStats.get(accountName);
        if (stats) {
            stats.failures++;
            
            // Mark as invalid if too many failures
            if (stats.failures > 3) {
                stats.isValid = false;
                console.log(`❌ Cookie account ${accountName} marked as invalid after ${stats.failures} failures`);
                
                // Try to refresh this account
                this.refreshCookieAccount(accountName);
            } else {
                console.log(`⚠️ Cookie account ${accountName} failure ${stats.failures}/3:`, error.message);
            }
        }
    }

    async refreshCookieAccount(accountName) {
        if (this.refreshInProgress.has(accountName)) {
            console.log(`🔄 Cookie refresh already in progress for ${accountName}`);
            return false;
        }

        this.refreshInProgress.add(accountName);
        console.log(`🔄 Starting cookie refresh for account: ${accountName}`);

        try {
            const account = this.cookieAccounts.find(acc => acc.name === accountName);
            if (!account) {
                throw new Error(`Account ${accountName} not found`);
            }

            // Method 1: Try to extract fresh cookies using yt-dlp
            const success = await this.extractCookiesWithYtDlp(account);
            
            if (success) {
                // Update account stats
                const stats = this.cookieStats.get(accountName);
                stats.lastRefresh = Date.now();
                stats.isValid = true;
                stats.failures = 0;
                
                console.log(`✅ Successfully refreshed cookies for ${accountName}`);
                return true;
            } else {
                console.log(`❌ Failed to refresh cookies for ${accountName}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error refreshing cookies for ${accountName}:`, error);
            return false;
        } finally {
            this.refreshInProgress.delete(accountName);
        }
    }

    async extractCookiesWithYtDlp(account) {
        return new Promise((resolve) => {
            const backupPath = `${account.path}.backup.${Date.now()}`;
            
            // Backup current cookies
            if (fs.existsSync(account.path)) {
                fs.copyFileSync(account.path, backupPath);
            }

            const ytdlpArgs = [
                '--cookies-from-browser', 'chrome',
                '--cookies', account.path,
                '--skip-download',
                '--no-warnings',
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            ];

            const ytdlp = spawn('yt-dlp', ytdlpArgs, {
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
                if (code === 0 && fs.existsSync(account.path)) {
                    const stats = fs.statSync(account.path);
                    if (stats.size > 100) { // Basic validation
                        console.log(`✅ Extracted fresh cookies for ${account.name}`);
                        // Remove backup
                        if (fs.existsSync(backupPath)) {
                            fs.unlinkSync(backupPath);
                        }
                        resolve(true);
                    } else {
                        console.log(`❌ Extracted cookies file too small for ${account.name}`);
                        // Restore backup
                        if (fs.existsSync(backupPath)) {
                            fs.copyFileSync(backupPath, account.path);
                            fs.unlinkSync(backupPath);
                        }
                        resolve(false);
                    }
                } else {
                    console.log(`❌ yt-dlp cookie extraction failed for ${account.name}:`, errorOutput);
                    // Restore backup
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, account.path);
                        fs.unlinkSync(backupPath);
                    }
                    resolve(false);
                }
            });

            // Set timeout
            setTimeout(() => {
                ytdlp.kill('SIGTERM');
                resolve(false);
            }, 30000);
        });
    }

    startCookieHealthMonitoring() {
        // Check cookie health every 30 minutes
        setInterval(() => {
            this.performCookieHealthCheck();
        }, 30 * 60 * 1000);

        // Initial health check
        setTimeout(() => {
            this.performCookieHealthCheck();
        }, 5000);
    }

    async performCookieHealthCheck() {
        console.log('🏥 Performing cookie health check...');
        
        for (const account of this.cookieAccounts) {
            const stats = this.cookieStats.get(account.name);
            
            // Check if cookies are old (older than 24 hours)
            const ageHours = (Date.now() - account.lastModified.getTime()) / (1000 * 60 * 60);
            
            if (ageHours > 24) {
                console.log(`⏰ Cookies for ${account.name} are ${ageHours.toFixed(1)} hours old, refreshing...`);
                await this.refreshCookieAccount(account.name);
            }
            
            // Check failure rate
            const totalAttempts = stats.successes + stats.failures;
            if (totalAttempts > 10) {
                const failureRate = stats.failures / totalAttempts;
                if (failureRate > 0.5) {
                    console.log(`📊 High failure rate (${(failureRate * 100).toFixed(1)}%) for ${account.name}, refreshing...`);
                    await this.refreshCookieAccount(account.name);
                }
            }
        }
    }

    addNewCookieAccount(accountName, cookieContent) {
        const accountPath = path.join(this.accountsDir, `${accountName}.txt`);
        
        try {
            fs.writeFileSync(accountPath, cookieContent);
            console.log(`✅ Added new cookie account: ${accountName}`);
            
            // Reload accounts
            this.loadCookieAccounts();
            return true;
        } catch (error) {
            console.error(`❌ Error adding cookie account ${accountName}:`, error);
            return false;
        }
    }

    getStats() {
        const totalAccounts = this.cookieAccounts.length;
        const activeAccounts = this.cookieAccounts.filter(acc => acc.active).length;
        
        let totalSuccesses = 0;
        let totalFailures = 0;
        let validAccounts = 0;
        
        for (const stats of this.cookieStats.values()) {
            totalSuccesses += stats.successes;
            totalFailures += stats.failures;
            if (stats.isValid) validAccounts++;
        }
        
        const successRate = totalSuccesses + totalFailures > 0 
            ? totalSuccesses / (totalSuccesses + totalFailures)
            : 0;
        
        return {
            totalAccounts,
            activeAccounts,
            validAccounts,
            successRate,
            totalRequests: totalSuccesses + totalFailures,
            successfulRequests: totalSuccesses,
            failedRequests: totalFailures
        };
    }

    getCookieStats() {
        const stats = {};
        for (const [accountName, accountStats] of this.cookieStats.entries()) {
            const account = this.cookieAccounts.find(acc => acc.name === accountName);
            stats[accountName] = {
                ...accountStats,
                fileSize: account ? account.size : 0,
                lastModified: account ? account.lastModified : null,
                active: account ? account.active : false
            };
        }
        return stats;
    }

    printCookieStats() {
        console.log('\n🍪 Cookie Account Statistics:');
        for (const [accountName, stats] of this.cookieStats.entries()) {
            const successRate = stats.successes + stats.failures > 0 
                ? (stats.successes / (stats.successes + stats.failures) * 100).toFixed(1)
                : 'N/A';
            
            const lastUsed = stats.lastUsed ? new Date(stats.lastUsed).toLocaleString() : 'Never';
            const isValid = stats.isValid ? '✅' : '❌';
            
            console.log(`  ${isValid} ${accountName}: ${stats.successes} successes, ${stats.failures} failures (${successRate}% success rate)`);
            console.log(`    Last used: ${lastUsed}`);
        }
    }
}

export default CookieManagementService;