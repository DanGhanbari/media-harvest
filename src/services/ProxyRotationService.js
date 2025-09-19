import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

class ProxyRotationService {
    constructor() {
        this.proxies = {
            residential: [],
            datacenter: [],
            free: []
        };
        this.currentProxyIndex = {
            residential: 0,
            datacenter: 0,
            free: 0
        };
        this.failedProxies = new Set();
        this.proxyStats = new Map();
        this.loadProxies();
    }

    loadProxies() {
        try {
            // Load proxy configurations from environment or config file
            const proxyConfig = {
                residential: [
                    // Premium residential proxies (add your providers)
                    { host: 'residential1.proxy.com', port: 8080, username: process.env.RESIDENTIAL_PROXY_USER, password: process.env.RESIDENTIAL_PROXY_PASS },
                    { host: 'residential2.proxy.com', port: 8080, username: process.env.RESIDENTIAL_PROXY_USER2, password: process.env.RESIDENTIAL_PROXY_PASS2 }
                ],
                datacenter: [
                    // Datacenter proxies
                    { host: 'datacenter1.proxy.com', port: 3128, username: process.env.DATACENTER_PROXY_USER, password: process.env.DATACENTER_PROXY_PASS },
                    { host: 'datacenter2.proxy.com', port: 3128, username: process.env.DATACENTER_PROXY_USER2, password: process.env.DATACENTER_PROXY_PASS2 }
                ],
                free: [
                    // Free proxies (less reliable but good for fallback)
                    { host: '8.8.8.8', port: 3128 },
                    { host: '1.1.1.1', port: 3128 }
                ]
            };

            this.proxies = proxyConfig;
            console.log('📡 Loaded proxy configurations:', {
                residential: this.proxies.residential.length,
                datacenter: this.proxies.datacenter.length,
                free: this.proxies.free.length
            });
        } catch (error) {
            console.error('❌ Error loading proxy configurations:', error);
        }
    }

    getNextProxy(type = 'residential') {
        const availableProxies = this.proxies[type].filter(proxy => 
            !this.failedProxies.has(`${proxy.host}:${proxy.port}`)
        );

        if (availableProxies.length === 0) {
            // If all proxies of this type failed, try next type
            if (type === 'residential') return this.getNextProxy('datacenter');
            if (type === 'datacenter') return this.getNextProxy('free');
            if (type === 'free') {
                // Reset failed proxies and try again
                this.resetFailedProxies();
                return this.getNextProxy('residential');
            }
        }

        const currentIndex = this.currentProxyIndex[type] % availableProxies.length;
        const proxy = availableProxies[currentIndex];
        this.currentProxyIndex[type] = (currentIndex + 1) % availableProxies.length;

        return {
            ...proxy,
            type,
            id: `${proxy.host}:${proxy.port}`
        };
    }

    markProxyFailed(proxyId, error) {
        this.failedProxies.add(proxyId);
        
        // Update proxy statistics
        if (!this.proxyStats.has(proxyId)) {
            this.proxyStats.set(proxyId, { failures: 0, successes: 0, lastUsed: Date.now() });
        }
        
        const stats = this.proxyStats.get(proxyId);
        stats.failures++;
        stats.lastUsed = Date.now();
        
        console.log(`❌ Proxy ${proxyId} marked as failed:`, error.message);
        console.log(`📊 Proxy stats:`, stats);
    }

    markProxySuccess(proxyId) {
        // Remove from failed list if it was there
        this.failedProxies.delete(proxyId);
        
        // Update proxy statistics
        if (!this.proxyStats.has(proxyId)) {
            this.proxyStats.set(proxyId, { failures: 0, successes: 0, lastUsed: Date.now() });
        }
        
        const stats = this.proxyStats.get(proxyId);
        stats.successes++;
        stats.lastUsed = Date.now();
        
        console.log(`✅ Proxy ${proxyId} successful`);
    }

    resetFailedProxies() {
        console.log('🔄 Resetting failed proxies list');
        this.failedProxies.clear();
    }

    createProxyAgent(proxy) {
        if (!proxy) return null;

        const proxyUrl = proxy.username && proxy.password 
            ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
            : `http://${proxy.host}:${proxy.port}`;

        // For HTTPS requests

        return {
            http: new HttpProxyAgent(proxyUrl),
            https: new HttpsProxyAgent(proxyUrl),
            proxy
        };
    }

    async testProxy(proxy) {
        return new Promise((resolve) => {
            const agent = this.createProxyAgent(proxy);
            if (!agent) {
                resolve(false);
                return;
            }

            const options = {
                hostname: 'httpbin.org',
                path: '/ip',
                method: 'GET',
                agent: agent.https,
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log(`✅ Proxy ${proxy.host}:${proxy.port} working, IP: ${result.origin}`);
                        resolve(true);
                    } catch (error) {
                        console.log(`❌ Proxy ${proxy.host}:${proxy.port} invalid response`);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.log(`❌ Proxy ${proxy.host}:${proxy.port} failed:`, error.message);
                resolve(false);
            });

            req.on('timeout', () => {
                console.log(`⏰ Proxy ${proxy.host}:${proxy.port} timeout`);
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    async testAllProxies() {
        console.log('🧪 Testing all proxy connections...');
        
        for (const type of ['residential', 'datacenter', 'free']) {
            console.log(`\n📡 Testing ${type} proxies:`);
            
            for (const proxy of this.proxies[type]) {
                const isWorking = await this.testProxy(proxy);
                if (!isWorking) {
                    this.markProxyFailed(`${proxy.host}:${proxy.port}`, new Error('Connection test failed'));
                }
            }
        }
        
        console.log('\n📊 Proxy test completed');
        this.printProxyStats();
    }

    getStats() {
        const totalProxies = Object.values(this.proxies).flat().length;
        const failedProxies = this.failedProxies.size;
        const activeProxies = totalProxies - failedProxies;
        
        let totalSuccesses = 0;
        let totalFailures = 0;
        
        for (const stats of this.proxyStats.values()) {
            totalSuccesses += stats.successes;
            totalFailures += stats.failures;
        }
        
        const successRate = totalSuccesses + totalFailures > 0 
            ? totalSuccesses / (totalSuccesses + totalFailures)
            : 0;
        
        return {
            totalProxies,
            activeProxies,
            failedProxies,
            successRate,
            totalRequests: totalSuccesses + totalFailures,
            successfulRequests: totalSuccesses,
            failedRequests: totalFailures
        };
    }

    printProxyStats() {
        console.log('\n📈 Proxy Statistics:');
        for (const [proxyId, stats] of this.proxyStats.entries()) {
            const successRate = stats.successes + stats.failures > 0 
                ? (stats.successes / (stats.successes + stats.failures) * 100).toFixed(1)
                : 'N/A';
            
            console.log(`  ${proxyId}: ${stats.successes} successes, ${stats.failures} failures (${successRate}% success rate)`);
        }
        
        console.log(`\n❌ Currently failed proxies: ${this.failedProxies.size}`);
    }

    getProxyForYtDlp(preferredType = 'residential') {
        const proxy = this.getNextProxy(preferredType);
        if (!proxy) return null;

        // Format for yt-dlp
        const proxyUrl = proxy.username && proxy.password 
            ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
            : `http://${proxy.host}:${proxy.port}`;

        return {
            url: proxyUrl,
            proxy: proxy
        };
    }
}

export default ProxyRotationService;