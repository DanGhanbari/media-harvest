import { spawn } from 'child_process';

class FormatSelectionService {
    constructor() {
        this.qualityProfiles = {
            // Ultra High Quality (4K+)
            'ultra': {
                video: 'best[height>=2160][ext=mp4]/best[height>=2160]/best[ext=mp4]',
                audio: 'bestaudio[ext=m4a]/bestaudio',
                fallback: ['high', 'medium', 'low'],
                description: '4K Ultra HD (2160p+)',
                estimatedSize: '8-15 GB/hour',
                bandwidth: '25+ Mbps'
            },
            
            // High Quality (1080p)
            'high': {
                video: 'best[height<=1080][height>=720][ext=mp4]/best[height<=1080][ext=mp4]',
                audio: 'bestaudio[ext=m4a]/bestaudio',
                fallback: ['medium', 'low'],
                description: 'Full HD (1080p)',
                estimatedSize: '3-6 GB/hour',
                bandwidth: '8-15 Mbps'
            },
            
            // Medium Quality (720p)
            'medium': {
                video: 'best[height<=720][height>=480][ext=mp4]/best[height<=720][ext=mp4]',
                audio: 'bestaudio[ext=m4a]/bestaudio',
                fallback: ['low', 'minimum'],
                description: 'HD (720p)',
                estimatedSize: '1.5-3 GB/hour',
                bandwidth: '4-8 Mbps'
            },
            
            // Low Quality (480p)
            'low': {
                video: 'best[height<=480][height>=360][ext=mp4]/best[height<=480][ext=mp4]',
                audio: 'bestaudio[ext=m4a]/bestaudio',
                fallback: ['minimum'],
                description: 'SD (480p)',
                estimatedSize: '0.8-1.5 GB/hour',
                bandwidth: '2-4 Mbps'
            },
            
            // Minimum Quality (360p and below)
            'minimum': {
                video: 'worst[ext=mp4]/worst',
                audio: 'worstaudio[ext=m4a]/worstaudio',
                fallback: [],
                description: 'Low Quality (360p or below)',
                estimatedSize: '0.3-0.8 GB/hour',
                bandwidth: '1-2 Mbps'
            },
            
            // Audio Only
            'audio': {
                video: null,
                audio: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
                fallback: [],
                description: 'Audio Only (Best Quality)',
                estimatedSize: '50-150 MB/hour',
                bandwidth: '128-320 kbps'
            },
            
            // Live Stream Optimized
            'live': {
                video: 'best[height<=720][protocol^=http]/best[protocol^=http]',
                audio: 'bestaudio[protocol^=http]/bestaudio',
                fallback: ['medium', 'low'],
                description: 'Live Stream (720p max)',
                estimatedSize: 'Variable',
                bandwidth: '2-8 Mbps'
            },
            
            // Mobile Optimized
            'mobile': {
                video: 'best[height<=480][filesize<500M]/best[height<=480]',
                audio: 'bestaudio[abr<=128]/bestaudio',
                fallback: ['minimum'],
                description: 'Mobile Optimized (480p, <500MB)',
                estimatedSize: '<500 MB',
                bandwidth: '1-3 Mbps'
            },
            
            // Bandwidth Constrained
            'constrained': {
                video: 'best[height<=360][tbr<=1000]/best[height<=360]',
                audio: 'bestaudio[abr<=96]/bestaudio',
                fallback: ['minimum'],
                description: 'Bandwidth Constrained (360p, <1Mbps)',
                estimatedSize: '<300 MB/hour',
                bandwidth: '<1 Mbps'
            }
        };
        
        this.platformOptimizations = {
            'youtube': {
                preferredCodecs: ['avc1', 'vp9', 'av01'],
                audioCodecs: ['mp4a', 'opus'],
                maxFragments: 100,
                chunkSize: '10M'
            },
            'twitch': {
                preferredCodecs: ['avc1'],
                audioCodecs: ['mp4a'],
                maxFragments: 50,
                chunkSize: '5M'
            },
            'tiktok': {
                preferredCodecs: ['avc1'],
                audioCodecs: ['mp4a'],
                maxFragments: 20,
                chunkSize: '2M'
            },
            'instagram': {
                preferredCodecs: ['avc1'],
                audioCodecs: ['mp4a'],
                maxFragments: 30,
                chunkSize: '3M'
            },
            'default': {
                preferredCodecs: ['avc1', 'vp9'],
                audioCodecs: ['mp4a', 'opus'],
                maxFragments: 50,
                chunkSize: '5M'
            }
        };
        
        this.adaptiveSettings = {
            networkSpeedThresholds: {
                'fast': 10000000, // 10 Mbps
                'medium': 5000000, // 5 Mbps
                'slow': 2000000,   // 2 Mbps
                'very_slow': 1000000 // 1 Mbps
            },
            qualityMappings: {
                'fast': ['ultra', 'high'],
                'medium': ['high', 'medium'],
                'slow': ['medium', 'low'],
                'very_slow': ['low', 'minimum']
            }
        };
        
        this.formatStats = {
            successRates: new Map(),
            downloadTimes: new Map(),
            failureReasons: new Map()
        };
        
        console.log('🎯 Format Selection Service initialized');
    }

    async selectOptimalFormat(url, requestedQuality, options = {}) {
        const {
            platform = this.detectPlatform(url),
            networkSpeed = null,
            maxFileSize = null,
            preferAudio = false,
            adaptiveBitrate = true,
            fallbackEnabled = true
        } = options;
        
        console.log(`🎯 Selecting optimal format for ${platform}:`);
        console.log(`   Requested quality: ${requestedQuality}`);
        console.log(`   Network speed: ${networkSpeed ? (networkSpeed / 1000000).toFixed(1) + ' Mbps' : 'Unknown'}`);
        console.log(`   Adaptive bitrate: ${adaptiveBitrate}`);
        
        // Get base quality profile
        let selectedQuality = requestedQuality;
        
        // Apply adaptive bitrate selection
        if (adaptiveBitrate && networkSpeed) {
            selectedQuality = this.adaptQualityToNetwork(requestedQuality, networkSpeed);
            if (selectedQuality !== requestedQuality) {
                console.log(`📉 Quality adapted from ${requestedQuality} to ${selectedQuality} based on network speed`);
            }
        }
        
        // Get quality profile
        const qualityProfile = this.qualityProfiles[selectedQuality];
        if (!qualityProfile) {
            throw new Error(`Unknown quality profile: ${selectedQuality}`);
        }
        
        // Build format selector
        const formatSelector = this.buildFormatSelector(qualityProfile, platform, {
            maxFileSize,
            preferAudio
        });
        
        // Prepare fallback chain
        const fallbackChain = fallbackEnabled ? this.buildFallbackChain(selectedQuality, platform, options) : [];
        
        const result = {
            primary: {
                quality: selectedQuality,
                selector: formatSelector,
                profile: qualityProfile
            },
            fallbacks: fallbackChain,
            platform,
            adaptiveSettings: this.getAdaptiveSettings(platform),
            estimatedBandwidth: qualityProfile.bandwidth,
            estimatedSize: qualityProfile.estimatedSize
        };
        
        console.log(`✅ Format selection complete:`);
        console.log(`   Primary: ${formatSelector}`);
        console.log(`   Fallbacks: ${fallbackChain.length} options`);
        console.log(`   Estimated size: ${qualityProfile.estimatedSize}`);
        
        return result;
    }

    adaptQualityToNetwork(requestedQuality, networkSpeed) {
        const speedCategory = this.categorizeNetworkSpeed(networkSpeed);
        const recommendedQualities = this.adaptiveSettings.qualityMappings[speedCategory];
        
        // If requested quality is in recommended list, use it
        if (recommendedQualities.includes(requestedQuality)) {
            return requestedQuality;
        }
        
        // Otherwise, find the best match
        const qualityOrder = ['ultra', 'high', 'medium', 'low', 'minimum', 'audio'];
        const requestedIndex = qualityOrder.indexOf(requestedQuality);
        
        // Find the highest recommended quality that's not higher than requested
        for (const quality of recommendedQualities) {
            const qualityIndex = qualityOrder.indexOf(quality);
            if (qualityIndex >= requestedIndex) {
                return quality;
            }
        }
        
        // Fallback to the highest recommended quality
        return recommendedQualities[0];
    }

    categorizeNetworkSpeed(speed) {
        const thresholds = this.adaptiveSettings.networkSpeedThresholds;
        
        if (speed >= thresholds.fast) return 'fast';
        if (speed >= thresholds.medium) return 'medium';
        if (speed >= thresholds.slow) return 'slow';
        return 'very_slow';
    }

    buildFormatSelector(qualityProfile, platform, options = {}) {
        const { maxFileSize, preferAudio } = options;
        const platformOpts = this.platformOptimizations[platform] || this.platformOptimizations.default;
        
        let selector = '';
        
        if (preferAudio || qualityProfile.video === null) {
            // Audio-only selection
            selector = qualityProfile.audio;
        } else {
            // Video + audio selection
            let videoSelector = qualityProfile.video;
            let audioSelector = qualityProfile.audio;
            
            // Add codec preferences
            if (platformOpts.preferredCodecs.length > 0) {
                const codecFilter = platformOpts.preferredCodecs.map(codec => `vcodec^=${codec}`).join('/');
                videoSelector = videoSelector.replace(/\[/, `[${codecFilter},`);
            }
            
            // Add file size constraint
            if (maxFileSize) {
                const sizeFilter = `filesize<${maxFileSize}`;
                videoSelector = videoSelector.replace(/\[/, `[${sizeFilter},`);
            }
            
            // Combine video and audio
            selector = `${videoSelector}+${audioSelector}`;
        }
        
        return selector;
    }

    buildFallbackChain(primaryQuality, platform, options = {}) {
        const qualityProfile = this.qualityProfiles[primaryQuality];
        const fallbackQualities = qualityProfile.fallback || [];
        
        const fallbackChain = [];
        
        for (const fallbackQuality of fallbackQualities) {
            const fallbackProfile = this.qualityProfiles[fallbackQuality];
            if (fallbackProfile) {
                const fallbackSelector = this.buildFormatSelector(fallbackProfile, platform, options);
                
                fallbackChain.push({
                    quality: fallbackQuality,
                    selector: fallbackSelector,
                    profile: fallbackProfile,
                    reason: `Fallback from ${primaryQuality}`
                });
            }
        }
        
        // Add emergency fallback
        if (primaryQuality !== 'minimum' && !fallbackQualities.includes('minimum')) {
            const minimumProfile = this.qualityProfiles.minimum;
            const minimumSelector = this.buildFormatSelector(minimumProfile, platform, options);
            
            fallbackChain.push({
                quality: 'minimum',
                selector: minimumSelector,
                profile: minimumProfile,
                reason: 'Emergency fallback'
            });
        }
        
        return fallbackChain;
    }

    getAdaptiveSettings(platform) {
        const platformOpts = this.platformOptimizations[platform] || this.platformOptimizations.default;
        
        return {
            retryFragments: true,
            maxFragmentRetries: 5,
            fragmentRetryDelay: 1000,
            chunkSize: platformOpts.chunkSize,
            maxFragments: platformOpts.maxFragments,
            bufferSize: '16M',
            socketTimeout: 30,
            readTimeout: 30
        };
    }

    async testFormatAvailability(url, formatSelector) {
        console.log(`🧪 Testing format availability: ${formatSelector}`);
        
        return new Promise((resolve) => {
            const testProcess = spawn('yt-dlp', [
                '--format', formatSelector,
                '--simulate',
                '--quiet',
                '--no-warnings',
                url
            ]);
            
            let available = false;
            
            testProcess.on('close', (code) => {
                available = code === 0;
                console.log(`${available ? '✅' : '❌'} Format test result: ${available ? 'Available' : 'Not available'}`);
                resolve(available);
            });
            
            testProcess.on('error', () => {
                resolve(false);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                testProcess.kill();
                resolve(false);
            }, 10000);
        });
    }

    async getAvailableFormats(url) {
        console.log(`📋 Fetching available formats for: ${url}`);
        
        return new Promise((resolve, reject) => {
            const listProcess = spawn('yt-dlp', [
                '--list-formats',
                '--no-warnings',
                url
            ]);
            
            let output = '';
            let error = '';
            
            listProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            listProcess.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            listProcess.on('close', (code) => {
                if (code === 0) {
                    const formats = this.parseFormatList(output);
                    console.log(`📋 Found ${formats.length} available formats`);
                    resolve(formats);
                } else {
                    console.error(`❌ Failed to list formats: ${error}`);
                    reject(new Error(`Failed to list formats: ${error}`));
                }
            });
            
            listProcess.on('error', (err) => {
                reject(err);
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                listProcess.kill();
                reject(new Error('Format listing timeout'));
            }, 30000);
        });
    }

    parseFormatList(output) {
        const formats = [];
        const lines = output.split('\n');
        
        let inFormatSection = false;
        
        for (const line of lines) {
            if (line.includes('format code')) {
                inFormatSection = true;
                continue;
            }
            
            if (!inFormatSection || line.trim() === '') {
                continue;
            }
            
            // Parse format line
            const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
            if (match) {
                const [, formatId, ext, resolution, note] = match;
                
                formats.push({
                    id: formatId,
                    ext,
                    resolution,
                    note: note.trim(),
                    quality: this.estimateQuality(resolution),
                    isAudio: resolution.includes('audio') || note.toLowerCase().includes('audio'),
                    isVideo: !resolution.includes('audio') && !note.toLowerCase().includes('audio')
                });
            }
        }
        
        return formats;
    }

    estimateQuality(resolution) {
        if (resolution.includes('2160') || resolution.includes('4K')) return 'ultra';
        if (resolution.includes('1080')) return 'high';
        if (resolution.includes('720')) return 'medium';
        if (resolution.includes('480')) return 'low';
        if (resolution.includes('360') || resolution.includes('240')) return 'minimum';
        if (resolution.includes('audio')) return 'audio';
        return 'unknown';
    }

    detectPlatform(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('twitch.tv')) return 'twitch';
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('facebook.com')) return 'facebook';
        return 'default';
    }

    recordFormatSuccess(quality, platform, downloadTime) {
        const key = `${platform}_${quality}`;
        
        if (!this.formatStats.successRates.has(key)) {
            this.formatStats.successRates.set(key, { successes: 0, attempts: 0 });
        }
        
        const stats = this.formatStats.successRates.get(key);
        stats.successes++;
        stats.attempts++;
        
        if (!this.formatStats.downloadTimes.has(key)) {
            this.formatStats.downloadTimes.set(key, []);
        }
        
        this.formatStats.downloadTimes.get(key).push(downloadTime);
        
        // Keep only last 100 download times
        const times = this.formatStats.downloadTimes.get(key);
        if (times.length > 100) {
            times.splice(0, times.length - 100);
        }
    }

    recordFormatFailure(quality, platform, reason) {
        const key = `${platform}_${quality}`;
        
        if (!this.formatStats.successRates.has(key)) {
            this.formatStats.successRates.set(key, { successes: 0, attempts: 0 });
        }
        
        const stats = this.formatStats.successRates.get(key);
        stats.attempts++;
        
        if (!this.formatStats.failureReasons.has(key)) {
            this.formatStats.failureReasons.set(key, new Map());
        }
        
        const reasons = this.formatStats.failureReasons.get(key);
        reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }

    getFormatStats() {
        const stats = {
            successRates: {},
            averageDownloadTimes: {},
            topFailureReasons: {},
            recommendations: []
        };
        
        // Calculate success rates
        for (const [key, data] of this.formatStats.successRates) {
            stats.successRates[key] = {
                rate: data.attempts > 0 ? (data.successes / data.attempts) : 0,
                successes: data.successes,
                attempts: data.attempts
            };
        }
        
        // Calculate average download times
        for (const [key, times] of this.formatStats.downloadTimes) {
            if (times.length > 0) {
                const average = times.reduce((sum, time) => sum + time, 0) / times.length;
                stats.averageDownloadTimes[key] = {
                    average: Math.round(average),
                    samples: times.length
                };
            }
        }
        
        // Get top failure reasons
        for (const [key, reasons] of this.formatStats.failureReasons) {
            const sortedReasons = Array.from(reasons.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3);
            
            stats.topFailureReasons[key] = sortedReasons.map(([reason, count]) => ({
                reason,
                count
            }));
        }
        
        // Generate recommendations
        stats.recommendations = this.generateFormatRecommendations(stats);
        
        return stats;
    }

    generateFormatRecommendations(stats) {
        const recommendations = [];
        
        // Find formats with low success rates
        for (const [key, data] of Object.entries(stats.successRates)) {
            if (data.attempts >= 5 && data.rate < 0.5) {
                recommendations.push({
                    type: 'warning',
                    message: `Format ${key} has low success rate (${(data.rate * 100).toFixed(1)}%). Consider using fallback quality.`,
                    format: key,
                    successRate: data.rate
                });
            }
        }
        
        // Find slow formats
        for (const [key, data] of Object.entries(stats.averageDownloadTimes)) {
            if (data.samples >= 3 && data.average > 300000) { // 5 minutes
                recommendations.push({
                    type: 'info',
                    message: `Format ${key} has slow average download time (${(data.average / 1000).toFixed(1)}s). Consider lower quality for faster downloads.`,
                    format: key,
                    averageTime: data.average
                });
            }
        }
        
        return recommendations;
    }

    getQualityProfiles() {
        return Object.keys(this.qualityProfiles).map(key => ({
            id: key,
            ...this.qualityProfiles[key]
        }));
    }

    resetStats() {
        this.formatStats.successRates.clear();
        this.formatStats.downloadTimes.clear();
        this.formatStats.failureReasons.clear();
        console.log('📊 Format selection statistics reset');
    }
}

export default FormatSelectionService;