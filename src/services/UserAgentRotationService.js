class UserAgentRotationService {
    constructor() {
        this.userAgents = {
            desktop: {
                chrome: [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ],
                firefox: [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
                    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
                ],
                safari: [
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
                ],
                edge: [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
                ]
            },
            mobile: {
                android_chrome: [
                    'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                    'Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
                ],
                ios_safari: [
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
                    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
                ],
                android_firefox: [
                    'Mozilla/5.0 (Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
                    'Mozilla/5.0 (Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'
                ]
            },
            youtube_apps: {
                youtube_android: [
                    'com.google.android.youtube/19.02.39 (Linux; U; Android 14; SM-G998B) gzip',
                    'com.google.android.youtube/19.01.35 (Linux; U; Android 13; Pixel 7) gzip',
                    'com.google.android.youtube/18.49.37 (Linux; U; Android 12; SM-G975F) gzip'
                ],
                youtube_ios: [
                    'com.google.ios.youtube/19.02.3 (iPhone16,2; U; CPU iOS 17_2 like Mac OS X)',
                    'com.google.ios.youtube/19.01.2 (iPhone15,3; U; CPU iOS 17_1 like Mac OS X)'
                ],
                youtube_tv: [
                    'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36',
                    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 WebAppManager'
                ],
                youtube_music: [
                    'com.google.android.apps.youtube.music/6.02.51 (Linux; U; Android 14; SM-G998B) gzip',
                    'com.google.ios.youtubemusic/6.02.3 (iPhone16,2; U; CPU iOS 17_2 like Mac OS X)'
                ]
            }
        };

        this.currentIndex = 0;
        this.usageStats = new Map();
        this.blacklistedAgents = new Set();
        this.lastRotation = Date.now();
        this.rotationInterval = 300000; // 5 minutes
    }

    getAllUserAgents() {
        const allAgents = [];
        
        Object.values(this.userAgents).forEach(category => {
            Object.values(category).forEach(browserAgents => {
                allAgents.push(...browserAgents);
            });
        });
        
        return allAgents.filter(agent => !this.blacklistedAgents.has(agent));
    }

    getRandomUserAgent(type = 'any', browser = 'any') {
        let candidates = [];
        
        if (type === 'any') {
            candidates = this.getAllUserAgents();
        } else if (this.userAgents[type]) {
            if (browser === 'any') {
                Object.values(this.userAgents[type]).forEach(browserAgents => {
                    candidates.push(...browserAgents);
                });
            } else if (this.userAgents[type][browser]) {
                candidates = [...this.userAgents[type][browser]];
            }
        }
        
        // Filter out blacklisted agents
        candidates = candidates.filter(agent => !this.blacklistedAgents.has(agent));
        
        if (candidates.length === 0) {
            console.warn('⚠️ No available user agents, using fallback');
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }
        
        const randomAgent = candidates[Math.floor(Math.random() * candidates.length)];
        this.recordUsage(randomAgent);
        
        return randomAgent;
    }

    getNextUserAgent() {
        const allAgents = this.getAllUserAgents();
        
        if (allAgents.length === 0) {
            console.warn('⚠️ No available user agents, using fallback');
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }
        
        const agent = allAgents[this.currentIndex % allAgents.length];
        this.currentIndex++;
        this.recordUsage(agent);
        
        return agent;
    }

    getYouTubeOptimizedAgent() {
        // Prefer YouTube app user agents for better compatibility
        const youtubeAgents = [
            ...this.userAgents.youtube_apps.youtube_android,
            ...this.userAgents.youtube_apps.youtube_ios,
            ...this.userAgents.mobile.android_chrome,
            ...this.userAgents.mobile.ios_safari,
            ...this.userAgents.desktop.chrome
        ].filter(agent => !this.blacklistedAgents.has(agent));
        
        if (youtubeAgents.length === 0) {
            return this.getRandomUserAgent();
        }
        
        const agent = youtubeAgents[Math.floor(Math.random() * youtubeAgents.length)];
        this.recordUsage(agent);
        
        return agent;
    }

    shouldRotate() {
        return Date.now() - this.lastRotation > this.rotationInterval;
    }

    forceRotation() {
        this.lastRotation = Date.now();
        console.log('🔄 User agent rotation forced');
    }

    recordUsage(userAgent) {
        if (!this.usageStats.has(userAgent)) {
            this.usageStats.set(userAgent, {
                count: 0,
                lastUsed: Date.now(),
                successCount: 0,
                failureCount: 0
            });
        }
        
        const stats = this.usageStats.get(userAgent);
        stats.count++;
        stats.lastUsed = Date.now();
    }

    recordSuccess(userAgent) {
        if (this.usageStats.has(userAgent)) {
            this.usageStats.get(userAgent).successCount++;
        }
    }

    recordFailure(userAgent, reason = 'unknown') {
        if (this.usageStats.has(userAgent)) {
            const stats = this.usageStats.get(userAgent);
            stats.failureCount++;
            
            // Blacklist if failure rate is too high
            const failureRate = stats.failureCount / (stats.successCount + stats.failureCount);
            if (stats.failureCount > 5 && failureRate > 0.8) {
                this.blacklistUserAgent(userAgent, `High failure rate: ${(failureRate * 100).toFixed(1)}%`);
            }
        }
        
        console.log(`❌ User agent failure recorded: ${reason}`);
    }

    blacklistUserAgent(userAgent, reason = 'Manual blacklist') {
        this.blacklistedAgents.add(userAgent);
        console.log(`🚫 User agent blacklisted: ${reason}`);
        console.log(`   Agent: ${userAgent.substring(0, 100)}...`);
    }

    removeFromBlacklist(userAgent) {
        this.blacklistedAgents.delete(userAgent);
        console.log(`✅ User agent removed from blacklist`);
    }

    clearBlacklist() {
        this.blacklistedAgents.clear();
        console.log('🧹 User agent blacklist cleared');
    }

    getCompatibleHeaders(userAgent) {
        const headers = {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        // Customize headers based on user agent type
        if (userAgent.includes('Mobile')) {
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
            headers['Viewport-Width'] = '393';
        }
        
        if (userAgent.includes('iPhone')) {
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        }
        
        if (userAgent.includes('Chrome')) {
            headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
            headers['sec-ch-ua-mobile'] = userAgent.includes('Mobile') ? '?1' : '?0';
            headers['sec-ch-ua-platform'] = this.getPlatformFromUserAgent(userAgent);
            headers['Sec-Fetch-Dest'] = 'document';
            headers['Sec-Fetch-Mode'] = 'navigate';
            headers['Sec-Fetch-Site'] = 'none';
            headers['Sec-Fetch-User'] = '?1';
        }
        
        if (userAgent.includes('Firefox')) {
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
        }
        
        return headers;
    }

    getPlatformFromUserAgent(userAgent) {
        if (userAgent.includes('Windows')) return '"Windows"';
        if (userAgent.includes('Macintosh')) return '"macOS"';
        if (userAgent.includes('Linux')) return '"Linux"';
        if (userAgent.includes('Android')) return '"Android"';
        return '"Unknown"';
    }

    getYtDlpUserAgent() {
        // Get a user agent that works well with yt-dlp
        const preferredAgents = [
            ...this.userAgents.desktop.chrome,
            ...this.userAgents.mobile.android_chrome,
            ...this.userAgents.youtube_apps.youtube_android
        ].filter(agent => !this.blacklistedAgents.has(agent));
        
        if (preferredAgents.length === 0) {
            return this.getRandomUserAgent();
        }
        
        return preferredAgents[Math.floor(Math.random() * preferredAgents.length)];
    }

    getUsageStats() {
        const stats = {
            totalAgents: this.getAllUserAgents().length,
            blacklistedAgents: this.blacklistedAgents.size,
            usedAgents: this.usageStats.size,
            topPerformers: [],
            worstPerformers: []
        };
        
        // Calculate performance metrics
        const performanceData = [];
        for (const [agent, data] of this.usageStats.entries()) {
            const total = data.successCount + data.failureCount;
            if (total > 0) {
                performanceData.push({
                    agent: agent.substring(0, 80) + '...',
                    successRate: data.successCount / total,
                    totalUses: total,
                    lastUsed: new Date(data.lastUsed).toISOString()
                });
            }
        }
        
        // Sort by success rate
        performanceData.sort((a, b) => b.successRate - a.successRate);
        
        stats.topPerformers = performanceData.slice(0, 5);
        stats.worstPerformers = performanceData.slice(-5).reverse();
        
        return stats;
    }

    printStats() {
        const stats = this.getUsageStats();
        
        console.log('\n🤖 User Agent Rotation Statistics:');
        console.log(`  Total available agents: ${stats.totalAgents}`);
        console.log(`  Blacklisted agents: ${stats.blacklistedAgents}`);
        console.log(`  Used agents: ${stats.usedAgents}`);
        
        if (stats.topPerformers.length > 0) {
            console.log('\n🏆 Top Performing User Agents:');
            stats.topPerformers.forEach((agent, index) => {
                console.log(`  ${index + 1}. Success rate: ${(agent.successRate * 100).toFixed(1)}% (${agent.totalUses} uses)`);
                console.log(`     ${agent.agent}`);
            });
        }
        
        if (stats.worstPerformers.length > 0) {
            console.log('\n⚠️ Worst Performing User Agents:');
            stats.worstPerformers.forEach((agent, index) => {
                console.log(`  ${index + 1}. Success rate: ${(agent.successRate * 100).toFixed(1)}% (${agent.totalUses} uses)`);
                console.log(`     ${agent.agent}`);
            });
        }
    }

    resetStats() {
        this.usageStats.clear();
        this.currentIndex = 0;
        this.lastRotation = Date.now();
        console.log('📊 User agent statistics reset');
    }
}

export default UserAgentRotationService;